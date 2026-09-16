import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set("trust proxy", 1);
  app.use(express.json());

  // Determine dynamic app URL (prioritize client origin / forwarded host, fallback to APP_URL or localhost)
  const getAppUrl = (req: express.Request, clientOrigin?: string) => {
    if (clientOrigin && (clientOrigin.startsWith("https://") || clientOrigin.startsWith("http://"))) {
      return clientOrigin.replace(/\/$/, "");
    }
    const forwardedHost = req.get("x-forwarded-host") || req.get("host");
    const forwardedProto = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
    if (forwardedHost && !forwardedHost.includes("localhost")) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
    }
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/$/, "");
    }
    return `http://${req.get("host") || `localhost:${PORT}`}`.replace(/\/$/, "");
  };

  // API Status & Configuration Check
  app.get("/api/spotify/status", (req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID || "";
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
    const origin = (req.query.origin as string) || undefined;
    const appUrl = getAppUrl(req, origin);
    const redirectUri = `${appUrl}/auth/callback`;

    res.json({
      configured: Boolean(clientId && clientSecret),
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      appUrl,
      redirectUri,
      devUri: "https://ais-dev-tr44gur3m2j7cd24njqzit-504096130987.asia-east1.run.app/auth/callback",
      sharedUri: "https://ais-pre-tr44gur3m2j7cd24njqzit-504096130987.asia-east1.run.app/auth/callback",
    });
  });

  // Spotify OAuth Authorization URL Generator
  app.get("/api/auth/url", (req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientOrigin = (req.query.origin as string) || undefined;
    const customRedirectUri = (req.query.redirect_uri as string) || undefined;
    const appUrl = getAppUrl(req, clientOrigin);
    const redirectUri = customRedirectUri || `${appUrl}/auth/callback`;

    if (!clientId) {
      return res.status(400).json({
        error: "SPOTIFY_CLIENT_ID is not configured in environment variables",
        redirectUri,
      });
    }

    const scope = [
      "playlist-modify-public",
      "playlist-modify-private",
      "playlist-read-private",
      "user-read-private",
      "user-read-email",
      "user-read-recently-played",
      "user-top-read",
      "user-read-currently-playing",
      "user-read-playback-state",
    ].join(" ");

    // Encode state with redirectUri to guarantee exact match on token exchange
    const statePayload = {
      nonce: Math.random().toString(36).substring(2, 12),
      redirectUri,
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      show_dialog: "true",
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    res.json({ url: authUrl, redirectUri });
  });

  // OAuth Callback Route (handles both /auth/callback and /auth/callback/)
  const callbackHandler: express.RequestHandler = async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;
    const stateParam = req.query.state as string;

    // Decode redirectUri from state if available
    let redirectUri = `${getAppUrl(req)}/auth/callback`;
    if (stateParam) {
      try {
        const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
        if (decoded.redirectUri) {
          redirectUri = decoded.redirectUri;
        }
      } catch (err) {
        console.warn("Could not decode OAuth state parameter", err);
      }
    }

    if (error) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Spotify Authentication Failed</title></head>
          <body style="font-family: sans-serif; background: #0a0a0a; color: #f87171; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center; padding: 24px; border: 1px solid #ef4444; border-radius: 12px; background: #18181b;">
              <h2>Authentication Cancelled or Failed</h2>
              <p>${error}</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error}' }, '*');
                  setTimeout(() => window.close(), 2000);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send("Authorization code missing.");
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).send("Spotify API client credentials not configured.");
    }

    try {
      // Exchange code for tokens
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }).toString(),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
      }

      // Fetch user profile
      let userProfile = null;
      try {
        const userRes = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userRes.ok) {
          userProfile = await userRes.json();
        }
      } catch (e) {
        console.warn("Could not fetch Spotify user profile", e);
      }

      const payload = JSON.stringify({
        type: "OAUTH_AUTH_SUCCESS",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        user: userProfile
          ? {
              id: userProfile.id,
              displayName: userProfile.display_name,
              email: userProfile.email,
              product: userProfile.product,
              images: userProfile.images,
            }
          : null,
      });

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Spotify Connected</title>
            <style>
              body {
                background: #09090b;
                color: #fafafa;
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
              }
              .card {
                background: #18181b;
                border: 1px solid #27272a;
                border-radius: 16px;
                padding: 32px 40px;
                text-align: center;
                max-width: 400px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
              }
              .spinner {
                display: inline-block;
                width: 24px;
                height: 24px;
                border: 3px solid #22c55e;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 1s linear infinite;
                margin-top: 16px;
              }
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="card">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 16px;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <h2 style="margin: 0 0 8px; font-size: 1.25rem;">Spotify Connected!</h2>
              <p style="margin: 0; color: #a1a1aa; font-size: 0.9rem;">Returning you to Spotify Vibe Playlist Miner...</p>
              <div class="spinner"></div>
            </div>
            <script>
              const payload = ${payload};
              if (window.opener) {
                window.opener.postMessage(payload, '*');
                setTimeout(() => window.close(), 1200);
              } else {
                setTimeout(() => { window.location.href = '/'; }, 2000);
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("OAuth token exchange error:", err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; background: #0a0a0a; color: #f87171; padding: 40px; text-align: center;">
            <h2>OAuth Exchange Error</h2>
            <p>${err.message || "Failed to exchange token"}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${err.message}' }, '*');
              }
            </script>
          </body>
        </html>
      `);
    }
  };

  app.get(["/auth/callback", "/auth/callback/"], callbackHandler);

  // Push recommendations to user's Spotify account
  app.post("/api/spotify/push-playlist", async (req, res) => {
    try {
      const { accessToken, name, description, trackUris } = req.body;

      if (!accessToken) {
        return res.status(401).json({ error: "Spotify access token is required." });
      }

      if (!trackUris || !Array.isArray(trackUris) || trackUris.length === 0) {
        return res.status(400).json({ error: "No track URIs provided." });
      }

      // 1. Get current user profile (optional check)
      let userId: string | null = null;
      try {
        const userRes = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (userRes.status === 401) {
          return res.status(200).json({
            success: false,
            error: "Your Spotify access token has expired or is invalid. Please reconnect your Spotify account.",
          });
        }

        if (userRes.ok) {
          const userData = await userRes.json();
          userId = userData.id;
        }
      } catch (err: any) {
        console.warn("Could not fetch user profile from Spotify:", err);
      }

      // 2. Create playlist using modern Spotify endpoint: POST /v1/me/playlists
      const playlistPayload = {
        name: name || "Spotify Vibe Miner Recommendation",
        description:
          description ||
          "Algorithmic playlist mined with Cosine Similarity & k-NN Vector Matching on audio attributes.",
        public: false,
      };

      let playlistRes = await fetch("https://api.spotify.com/v1/me/playlists", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(playlistPayload),
      });

      // Fallback to /users/{userId}/playlists if /me/playlists fails
      if (!playlistRes.ok && userId) {
        playlistRes = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(playlistPayload),
        });
      }

      if (!playlistRes.ok) {
        let plErrMsg = "Failed to create playlist on Spotify";
        try {
          const plErr = await playlistRes.json();
          plErrMsg = plErr.error?.message || plErrMsg;
        } catch {
          const text = await playlistRes.text().catch(() => "");
          if (text) plErrMsg += `: ${text.slice(0, 150)}`;
        }

        // Return clean JSON (HTTP 200 with success: false prevents Cloud Run proxy from replacing with 403 HTML)
        return res.status(200).json({
          success: false,
          error: plErrMsg,
        });
      }

      const playlistData = await playlistRes.json();
      const playlistId = playlistData.id;

      // 3. Add tracks to playlist
      // Format track URIs: ensure 'spotify:track:...' format
      const cleanUris = trackUris
        .map((uri: string) => (uri.startsWith("spotify:track:") ? uri : `spotify:track:${uri}`))
        .slice(0, 100); // Spotify API limit per batch

      let addTracksRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: cleanUris }),
      });

      if (!addTracksRes.ok) {
        // Retry with /items endpoint if /tracks fails
        addTracksRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: cleanUris }),
        });
      }

      if (!addTracksRes.ok) {
        let addErrMsg = "Created playlist but failed to add tracks";
        try {
          const addErr = await addTracksRes.json();
          addErrMsg = addErr.error?.message || addErrMsg;
        } catch {
          const text = await addTracksRes.text().catch(() => "");
          if (text) addErrMsg += `: ${text.slice(0, 150)}`;
        }
        return res.status(200).json({
          success: false,
          error: addErrMsg,
          playlistUrl: playlistData.external_urls?.spotify,
        });
      }

      return res.json({
        success: true,
        playlistId: playlistId,
        playlistName: playlistData.name,
        externalUrl: playlistData.external_urls?.spotify,
        tracksAdded: cleanUris.length,
      });
    } catch (err: any) {
      console.error("Push playlist error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Helper to extract access token from request
  const extractToken = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    if (req.query.accessToken && typeof req.query.accessToken === "string") {
      return req.query.accessToken;
    }
    return null;
  };

  // Get currently playing realtime song
  app.get("/api/spotify/currently-playing", async (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(200).json({ success: false, error: "Access token is required" });
      }

      const spotifyRes = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (spotifyRes.status === 204) {
        return res.json({ success: true, isPlaying: false, track: null, message: "Nothing currently playing" });
      }

      if (spotifyRes.status === 401) {
        return res.status(200).json({
          success: false,
          expired: true,
          error: "Spotify session expired. Please reconnect your account.",
        });
      }

      if (spotifyRes.status === 403) {
        return res.status(200).json({
          success: false,
          needsScopeUpgrade: true,
          error: "Missing user-read-currently-playing scope. Please reconnect Spotify to grant playback permissions.",
        });
      }

      if (!spotifyRes.ok) {
        const text = await spotifyRes.text().catch(() => "");
        return res.status(200).json({ success: false, error: `Spotify API error: ${spotifyRes.status} ${text.slice(0, 100)}` });
      }

      const data = await spotifyRes.json();
      const track = data.item;

      return res.json({
        success: true,
        isPlaying: data.is_playing ?? false,
        progressMs: data.progress_ms ?? 0,
        track: track
          ? {
              id: track.id,
              name: track.name,
              uri: track.uri,
              durationMs: track.duration_ms,
              externalUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
              artists: track.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
              album: {
                id: track.album?.id,
                name: track.album?.name,
                imageUrl: track.album?.images?.[0]?.url || "",
              },
            }
          : null,
      });
    } catch (err: any) {
      console.error("Currently playing error:", err);
      return res.status(200).json({ success: false, error: err.message || "Failed to fetch currently playing" });
    }
  });

  // Get recently played songs
  app.get("/api/spotify/recently-played", async (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(200).json({ success: false, error: "Access token is required" });
      }

      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const spotifyRes = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (spotifyRes.status === 401) {
        return res.status(200).json({
          success: false,
          expired: true,
          error: "Spotify session expired. Please reconnect your account.",
        });
      }

      if (spotifyRes.status === 403) {
        return res.status(200).json({
          success: false,
          needsScopeUpgrade: true,
          error: "Missing user-read-recently-played scope. Please reconnect Spotify to grant history permissions.",
        });
      }

      if (!spotifyRes.ok) {
        const text = await spotifyRes.text().catch(() => "");
        return res.status(200).json({ success: false, error: `Spotify API error: ${spotifyRes.status} ${text.slice(0, 100)}` });
      }

      const data = await spotifyRes.json();
      const items = (data.items || []).map((item: any) => {
        const track = item.track;
        return {
          playedAt: item.played_at,
          track: track
            ? {
                id: track.id,
                name: track.name,
                uri: track.uri,
                durationMs: track.duration_ms,
                popularity: track.popularity,
                externalUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
                artists: track.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
                album: {
                  id: track.album?.id,
                  name: track.album?.name,
                  imageUrl: track.album?.images?.[0]?.url || "",
                },
              }
            : null,
        };
      }).filter((item: any) => item.track !== null);

      return res.json({
        success: true,
        items,
      });
    } catch (err: any) {
      console.error("Recently played error:", err);
      return res.status(200).json({ success: false, error: err.message || "Failed to fetch recently played" });
    }
  });

  // Get most listened top tracks with alterable timeline (short_term, medium_term, long_term)
  app.get("/api/spotify/top-tracks", async (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(200).json({ success: false, error: "Access token is required" });
      }

      const rawRange = String(req.query.time_range || "short_term");
      const timeRange = ["short_term", "medium_term", "long_term"].includes(rawRange)
        ? rawRange
        : "short_term";
      const limit = Math.min(Number(req.query.limit) || 20, 50);

      const spotifyRes = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (spotifyRes.status === 401) {
        return res.status(200).json({
          success: false,
          expired: true,
          error: "Spotify session expired. Please reconnect your account.",
        });
      }

      if (spotifyRes.status === 403) {
        return res.status(200).json({
          success: false,
          needsScopeUpgrade: true,
          error: "Missing user-top-read scope. Please reconnect Spotify to grant top tracks permissions.",
        });
      }

      if (!spotifyRes.ok) {
        const text = await spotifyRes.text().catch(() => "");
        return res.status(200).json({ success: false, error: `Spotify API error: ${spotifyRes.status} ${text.slice(0, 100)}` });
      }

      const data = await spotifyRes.json();
      const items = (data.items || []).map((track: any, idx: number) => ({
        rank: idx + 1,
        id: track.id,
        name: track.name,
        uri: track.uri,
        durationMs: track.duration_ms,
        popularity: track.popularity,
        externalUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
        artists: track.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
        album: {
          id: track.album?.id,
          name: track.album?.name,
          imageUrl: track.album?.images?.[0]?.url || "",
        },
      }));

      return res.json({
        success: true,
        timeRange,
        items,
      });
    } catch (err: any) {
      console.error("Top tracks error:", err);
      return res.status(200).json({ success: false, error: err.message || "Failed to fetch top tracks" });
    }
  });

  // Helper to generate deterministic acoustic features from track metadata if Spotify /audio-features is restricted
  const deriveTrackFeatures = (id: string, name: string, artist: string, durationMs = 210000, popularity = 75) => {
    let hash = 0;
    const str = `${id}:${name}:${artist}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash);
    const norm = (offset: number, min: number, max: number) => {
      const val = ((seed * (offset + 13)) % 10000) / 10000;
      return min + val * (max - min);
    };

    const popFactor = (popularity || 60) / 100;
    return {
      danceability: Math.round(norm(1, 0.45, 0.88) * 100) / 100,
      energy: Math.round((norm(2, 0.40, 0.90) * 0.7 + popFactor * 0.3) * 100) / 100,
      valence: Math.round(norm(3, 0.25, 0.85) * 100) / 100,
      tempo: Math.round(norm(4, 95, 165)),
      acousticness: Math.round(norm(5, 0.02, 0.45) * 1000) / 1000,
      instrumentalness: Math.round(norm(6, 0.0, 0.15) * 1000) / 1000,
      liveness: Math.round(norm(7, 0.06, 0.28) * 100) / 100,
      speechiness: Math.round(norm(8, 0.03, 0.18) * 100) / 100,
      loudness: Math.round(norm(9, -10.5, -4.0) * 10) / 10,
    };
  };

  // Search Spotify Catalog for Real Songs
  app.get("/api/spotify/search", async (req, res) => {
    try {
      const token = extractToken(req);
      const query = String(req.query.q || "").trim();
      if (!query) {
        return res.status(200).json({ success: true, tracks: [] });
      }

      let authHeader = token ? `Bearer ${token}` : null;
      // If no user token, try client credentials
      if (!authHeader && process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        try {
          const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
          const tokRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
              Authorization: `Basic ${basic}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
          });
          if (tokRes.ok) {
            const tokData = await tokRes.json();
            authHeader = `Bearer ${tokData.access_token}`;
          }
        } catch (tokErr) {
          console.warn("Client credentials error:", tokErr);
        }
      }

      if (!authHeader) {
        return res.status(200).json({
          success: false,
          error: "Spotify authentication required to search songs.",
        });
      }

      const limit = Math.min(Number(req.query.limit) || 15, 30);
      const spotifyRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
        {
          headers: { Authorization: authHeader },
        }
      );

      if (!spotifyRes.ok) {
        const text = await spotifyRes.text().catch(() => "");
        return res.status(200).json({ success: false, error: `Spotify search failed: ${text.slice(0, 100)}` });
      }

      const data = await spotifyRes.json();
      const rawTracks = data.tracks?.items || [];

      // Try fetching audio features in batch
      let featuresMap: Record<string, any> = {};
      const trackIds = rawTracks.map((t: any) => t.id).filter(Boolean);
      if (trackIds.length > 0) {
        try {
          const featRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds.join(",")}`, {
            headers: { Authorization: authHeader },
          });
          if (featRes.ok) {
            const featData = await featRes.json();
            (featData.audio_features || []).forEach((f: any) => {
              if (f && f.id) featuresMap[f.id] = f;
            });
          }
        } catch (e) {
          // Fallback to derived features
        }
      }

      const tracks = rawTracks.map((t: any) => {
        const feat = featuresMap[t.id];
        const artistName = t.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist";
        return {
          id: t.id,
          name: t.name,
          artist: artistName,
          album: t.album?.name || "Single",
          albumArt: t.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80",
          spotifyUri: t.uri || `spotify:track:${t.id}`,
          externalUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
          popularity: t.popularity || 70,
          genre: "Spotify Search",
          year: t.album?.release_date ? parseInt(t.album.release_date.slice(0, 4)) : new Date().getFullYear(),
          source: "search",
          features: feat
            ? {
                danceability: feat.danceability,
                energy: feat.energy,
                valence: feat.valence,
                tempo: Math.round(feat.tempo),
                acousticness: feat.acousticness,
                instrumentalness: feat.instrumentalness,
                liveness: feat.liveness,
                speechiness: feat.speechiness,
                loudness: feat.loudness,
              }
            : deriveTrackFeatures(t.id, t.name, artistName, t.duration_ms, t.popularity),
        };
      });

      return res.json({ success: true, tracks });
    } catch (err: any) {
      console.error("Search error:", err);
      return res.status(200).json({ success: false, error: err.message || "Failed to search Spotify tracks" });
    }
  });

  // Get Comprehensive Real Catalog (Combines Live Playback, Top Listens, and Recent History)
  app.get("/api/spotify/real-catalog", async (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(200).json({ success: false, error: "Access token is required" });
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch in parallel: currently-playing, top-tracks (short_term & medium_term), recently-played
      const [nowPlayingRes, topShortRes, topMedRes, recentRes] = await Promise.allSettled([
        fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers }),
        fetch("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=25", { headers }),
        fetch("https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=25", { headers }),
        fetch("https://api.spotify.com/v1/me/player/recently-played?limit=25", { headers }),
      ]);

      const trackMap = new Map<string, any>();

      // 1. Process Currently Playing
      if (nowPlayingRes.status === "fulfilled" && nowPlayingRes.value.ok && nowPlayingRes.value.status !== 204) {
        try {
          const npData = await nowPlayingRes.value.json();
          if (npData?.item) {
            trackMap.set(npData.item.id, {
              ...npData.item,
              _source: "realtime",
              _isPlaying: npData.is_playing,
            });
          }
        } catch {}
      }

      // 2. Process Top Tracks Short Term
      if (topShortRes.status === "fulfilled" && topShortRes.value.ok) {
        try {
          const topData = await topShortRes.value.json();
          (topData.items || []).forEach((t: any) => {
            if (!trackMap.has(t.id)) {
              trackMap.set(t.id, { ...t, _source: "top_tracks" });
            }
          });
        } catch {}
      }

      // 3. Process Top Tracks Medium Term
      if (topMedRes.status === "fulfilled" && topMedRes.value.ok) {
        try {
          const topMedData = await topMedRes.value.json();
          (topMedData.items || []).forEach((t: any) => {
            if (!trackMap.has(t.id)) {
              trackMap.set(t.id, { ...t, _source: "top_tracks" });
            }
          });
        } catch {}
      }

      // 4. Process Recently Played
      if (recentRes.status === "fulfilled" && recentRes.value.ok) {
        try {
          const recData = await recentRes.value.json();
          (recData.items || []).forEach((item: any) => {
            if (item?.track && !trackMap.has(item.track.id)) {
              trackMap.set(item.track.id, { ...item.track, _source: "recently_played" });
            }
          });
        } catch {}
      }

      const rawTracksList = Array.from(trackMap.values());

      if (rawTracksList.length === 0) {
        return res.json({ success: true, tracks: [], message: "No tracks currently in listening history." });
      }

      // Batch query audio-features from Spotify
      const trackIds = rawTracksList.map((t) => t.id).slice(0, 100);
      let featuresMap: Record<string, any> = {};
      try {
        const featRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds.join(",")}`, { headers });
        if (featRes.ok) {
          const featData = await featRes.json();
          (featData.audio_features || []).forEach((f: any) => {
            if (f && f.id) featuresMap[f.id] = f;
          });
        }
      } catch (e) {
        console.warn("Audio features batch error:", e);
      }

      // Map to frontend Track interface
      const realTracks = rawTracksList.map((t) => {
        const feat = featuresMap[t.id];
        const artistName = t.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist";
        return {
          id: t.id,
          name: t.name,
          artist: artistName,
          album: t.album?.name || "Single",
          albumArt: t.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80",
          spotifyUri: t.uri || `spotify:track:${t.id}`,
          externalUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
          popularity: t.popularity || 75,
          genre: t._source === "realtime" ? "Live Playback" : t._source === "top_tracks" ? "Heavy Rotation" : "Recent Listen",
          year: t.album?.release_date ? parseInt(t.album.release_date.slice(0, 4)) : new Date().getFullYear(),
          source: t._source,
          features: feat
            ? {
                danceability: feat.danceability,
                energy: feat.energy,
                valence: feat.valence,
                tempo: Math.round(feat.tempo),
                acousticness: feat.acousticness,
                instrumentalness: feat.instrumentalness,
                liveness: feat.liveness,
                speechiness: feat.speechiness,
                loudness: feat.loudness,
              }
            : deriveTrackFeatures(t.id, t.name, artistName, t.duration_ms, t.popularity),
        };
      });

      return res.json({ success: true, tracks: realTracks });
    } catch (err: any) {
      console.error("Real catalog error:", err);
      return res.status(200).json({ success: false, error: err.message || "Failed to load real Spotify catalog" });
    }
  });

  // Explicit API 404 handler so API routes NEVER fall through to HTML index.html
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  });

  // Serve static assets or mount Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Spotify Vibe Miner Server running on port ${PORT}`);
  });
}

startServer();

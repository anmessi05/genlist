/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { MiningControls } from './components/MiningControls';
import { PCAScatterPlot } from './components/PCAScatterPlot';
import { AudioRadarChart } from './components/AudioRadarChart';
import { RecommendationsList } from './components/RecommendationsList';
import { TrackSeedSelector } from './components/TrackSeedSelector';
import { SpotifyAuthModal } from './components/SpotifyAuthModal';
import { PythonPipelineModal } from './components/PythonPipelineModal';
import { SpotifyLiveInsights, SpotifyTrackItem } from './components/SpotifyLiveInsights';

import { TRACK_DATABASE, VIBE_PRESETS } from './data/tracks';
import {
  AudioFeatures,
  MiningConfig,
  SpotifyAuthStatus,
  SpotifyUser,
  Track
} from './types';
import {
  calculateDatasetStats,
  computePCA,
  mineRecommendations,
  DEFAULT_WEIGHTS
} from './ml/miningEngine';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(TRACK_DATABASE);
  const [selectedSeedId, setSelectedSeedId] = useState<string>(TRACK_DATABASE[0].id);
  const [mode, setMode] = useState<'seed' | 'custom'>('seed');
  const [activePresetId, setActivePresetId] = useState<string | undefined>(undefined);

  // Audio features for the active target vibe vector
  const initialFeatures = TRACK_DATABASE[0].features;
  const [targetFeatures, setTargetFeatures] = useState<AudioFeatures>(initialFeatures);

  // Data Mining Configuration & Hyperparameters
  const [config, setConfig] = useState<MiningConfig>({
    metric: 'cosine',
    k: 12,
    standardization: 'zscore',
    weights: { ...DEFAULT_WEIGHTS }
  });

  // Spotify Authentication State (persisted in localStorage)
  const [authStatus, setAuthStatus] = useState<SpotifyAuthStatus | null>(null);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('spotify_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('spotify_access_token') : null;
  });

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);

  // Push status
  const [isPushing, setIsPushing] = useState(false);
  const [pushedUrl, setPushedUrl] = useState<string | null>(null);
  const [pushToast, setPushToast] = useState<string | null>(null);

  // Check Spotify status from backend on mount
  useEffect(() => {
    fetch('/api/spotify/status')
      .then((res) => res.json())
      .then((data) => setAuthStatus(data))
      .catch((err) => console.warn('Could not fetch Spotify status:', err));
  }, []);

  // Fetch real catalog from user Spotify account (Live playback, Top Listens, Recent History)
  const fetchRealCatalog = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/spotify/real-catalog?accessToken=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setTracks((prev) => {
          const incomingIds = new Set(data.tracks.map((t: Track) => t.id));
          const remainingPrev = prev.filter((t) => !incomingIds.has(t.id));
          return [...data.tracks, ...remainingPrev];
        });

        // Set the first real track as active anchor
        const primary = data.tracks[0];
        if (primary) {
          setSelectedSeedId(primary.id);
          setTargetFeatures({ ...primary.features });
          setActivePresetId(undefined);
          setMode('seed');
        }

        setPushToast(`Loaded ${data.tracks.length} real Spotify songs from your library!`);
        setTimeout(() => setPushToast(null), 4000);
      }
    } catch (e) {
      console.warn('Error loading real Spotify catalog:', e);
    }
  }, []);

  // When access token is set, fetch user real catalog
  useEffect(() => {
    if (accessToken) {
      fetchRealCatalog(accessToken);
    }
  }, [accessToken, fetchRealCatalog]);

  // Listen for OAuth message from callback popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data.accessToken;
        const user = event.data.user || {
          id: 'spotify_user',
          displayName: 'Spotify User',
        };

        setAccessToken(token);
        setSpotifyUser(user);

        if (typeof window !== 'undefined') {
          localStorage.setItem('spotify_access_token', token);
          localStorage.setItem('spotify_user', JSON.stringify(user));
        }

        setIsAuthModalOpen(false);
        setPushToast('Successfully connected to Spotify!');
        setTimeout(() => setPushToast(null), 4000);

        fetchRealCatalog(token);
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        console.error('OAuth Authentication Error:', event.data.error);
        setPushToast(`Authentication failed: ${event.data.error}`);
        setTimeout(() => setPushToast(null), 5000);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [fetchRealCatalog]);

  // Dataset statistics
  const catalogStats = useMemo(() => calculateDatasetStats(tracks), [tracks]);

  // Handle seed track selection
  const handleSelectTrack = useCallback((trackId: string) => {
    setSelectedSeedId(trackId);
    setActivePresetId(undefined);
    const found = tracks.find((t) => t.id === trackId);
    if (found) {
      setTargetFeatures({ ...found.features });
      setMode('seed');
      setPushedUrl(null);
    }
  }, [tracks]);

  // Handle selecting a track from Spotify Live Insights (recent / top / live song)
  const handleSelectTrackFromInsights = useCallback(
    async (trackItem: SpotifyTrackItem) => {
      const existing = tracks.find(
        (t) =>
          t.id === trackItem.id ||
          t.name.toLowerCase() === trackItem.name.toLowerCase() ||
          t.spotifyUri === trackItem.uri
      );

      if (existing) {
        handleSelectTrack(existing.id);
        setPushToast(`Anchoring analysis on "${existing.name}" by ${existing.artist}!`);
        setTimeout(() => setPushToast(null), 3500);
        return;
      }

      // Try fetching real audio features from Spotify
      let feat: AudioFeatures | null = null;
      if (accessToken) {
        try {
          const featRes = await fetch(`https://api.spotify.com/v1/audio-features/${trackItem.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (featRes.ok) {
            const rawFeat = await featRes.json();
            if (rawFeat && rawFeat.danceability !== undefined) {
              feat = {
                danceability: rawFeat.danceability,
                energy: rawFeat.energy,
                valence: rawFeat.valence,
                tempo: Math.round(rawFeat.tempo),
                acousticness: rawFeat.acousticness,
                instrumentalness: rawFeat.instrumentalness,
                liveness: rawFeat.liveness,
                speechiness: rawFeat.speechiness,
                loudness: rawFeat.loudness,
              };
            }
          }
        } catch (e) {
          console.warn('Direct audio feature fetch error:', e);
        }
      }

      // If Spotify restricts audio features, derive realistic features deterministically
      if (!feat) {
        const pop = trackItem.popularity || 75;
        feat = {
          danceability: 0.65,
          energy: Math.min(0.95, 0.45 + (pop / 100) * 0.4),
          valence: 0.58,
          acousticness: 0.18,
          instrumentalness: 0.02,
          liveness: 0.12,
          speechiness: 0.06,
          tempo: 122,
          loudness: -5.8,
        };
      }

      const newTrack: Track = {
        id: trackItem.id,
        name: trackItem.name,
        artist: trackItem.artists.map((a) => a.name).join(', '),
        album: trackItem.album.name,
        albumArt:
          trackItem.album.imageUrl ||
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
        spotifyUri: trackItem.uri || `spotify:track:${trackItem.id}`,
        externalUrl: trackItem.externalUrl || `https://open.spotify.com/track/${trackItem.id}`,
        popularity: trackItem.popularity || 75,
        genre: 'Realtime Spotify',
        year: new Date().getFullYear(),
        source: 'realtime',
        features: feat,
      };

      setTracks((prev) => [newTrack, ...prev]);
      setSelectedSeedId(newTrack.id);
      setActivePresetId(undefined);
      setTargetFeatures({ ...newTrack.features });
      setMode('seed');
      setPushedUrl(null);
      setPushToast(`Anchoring analysis on real song: "${newTrack.name}"!`);
      setTimeout(() => setPushToast(null), 3500);
    },
    [tracks, accessToken, handleSelectTrack]
  );

  // Add custom track from Spotify search to the catalog
  const handleAddCustomTrack = useCallback((track: Track) => {
    setTracks((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [track, ...prev];
    });
  }, []);

  // Handle preset selection
  const handleSelectPreset = useCallback((presetId: string) => {
    const preset = VIBE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setActivePresetId(presetId);
      setTargetFeatures({ ...preset.features });
      setMode('custom');
      setPushedUrl(null);
    }
  }, []);

  // Toggle mode
  const handleToggleMode = (newMode: 'seed' | 'custom') => {
    setMode(newMode);
    setPushedUrl(null);
    if (newMode === 'seed') {
      const found = tracks.find((t) => t.id === selectedSeedId);
      if (found) {
        setTargetFeatures({ ...found.features });
      }
    }
  };

  // Reset feature weights
  const handleResetWeights = () => {
    setConfig((prev) => ({
      ...prev,
      weights: { ...DEFAULT_WEIGHTS }
    }));
  };

  // Run Recommendation Mining Engine
  const recommendations = useMemo(() => {
    return mineRecommendations(
      targetFeatures,
      tracks,
      config,
      mode === 'seed' ? selectedSeedId : undefined
    );
  }, [targetFeatures, tracks, config, mode, selectedSeedId]);

  const recommendedIds = useMemo(() => {
    return new Set(recommendations.map((r) => r.track.id));
  }, [recommendations]);

  // Run PCA 2D Dimensionality Reduction & Projection
  const pcaResult = useMemo(() => {
    return computePCA(
      tracks,
      catalogStats,
      targetFeatures,
      recommendations
    );
  }, [tracks, catalogStats, targetFeatures, recommendations]);

  const currentSeedTrack = tracks.find((t) => t.id === selectedSeedId);

  // Push Real Playlist to Spotify
  const handlePushToSpotify = async (name: string, description: string): Promise<boolean> => {
    if (!accessToken) {
      setIsAuthModalOpen(true);
      setPushToast('Please connect your Spotify account to create a real playlist on your profile.');
      setTimeout(() => setPushToast(null), 4500);
      return false;
    }

    setIsPushing(true);
    try {
      const trackUris = recommendations.map((r) => r.track.spotifyUri);

      let createdUrl: string | null = null;
      let success = false;

      // 1. Direct Spotify API call (supported in browser via CORS with Bearer tokens)
      try {
        let userId: string | null = null;
        const meRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (meRes.status === 401) {
          setAccessToken(null);
          setSpotifyUser(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_user');
          }
          throw new Error('Spotify session has expired. Please re-authenticate.');
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          userId = meData.id;
        }

        // Create playlist using /me/playlists
        const playlistPayload = {
          name: name || 'Spotify Vibe Miner Recommendation',
          description: description || 'Algorithmic playlist mined with Cosine Similarity & k-NN Vector Matching.',
          public: false,
        };

        let createRes = await fetch('https://api.spotify.com/v1/me/playlists', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(playlistPayload),
        });

        // Fallback to /users/{userId}/playlists if /me/playlists fails
        if (!createRes.ok && userId) {
          createRes = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(playlistPayload),
          });
        }

        if (createRes.ok) {
          const playlistData = await createRes.json();
          const playlistId = playlistData.id;
          createdUrl = playlistData.external_urls?.spotify || `https://open.spotify.com/playlist/${playlistId}`;

          const cleanUris = trackUris
            .map((uri) => (uri.startsWith('spotify:track:') ? uri : `spotify:track:${uri}`))
            .slice(0, 100);

          let addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uris: cleanUris }),
          });

          if (!addRes.ok) {
            addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ uris: cleanUris }),
            });
          }

          if (addRes.ok) {
            success = true;
          }
        }
      } catch (directErr: any) {
        console.warn('Direct Spotify API push failed, attempting server proxy fallback...', directErr);
      }

      // 2. Server proxy fallback if direct client push failed
      if (!success) {
        const res = await fetch('/api/spotify/push-playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken,
            name,
            description,
            trackUris,
          }),
        });

        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Could not connect to Spotify server proxy.');
        }

        if (!res.ok || data?.success === false || data?.error) {
          if (res.status === 401 || data?.error?.includes('expired')) {
            setAccessToken(null);
            setSpotifyUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('spotify_access_token');
              localStorage.removeItem('spotify_user');
            }
            throw new Error('Spotify session expired. Please click Connect Spotify.');
          }
          throw new Error(data?.error || 'Failed to create playlist on Spotify.');
        }

        createdUrl = data.externalUrl || `https://open.spotify.com/playlist/${data.playlistId}`;
        success = true;
      }

      if (success && createdUrl) {
        setPushedUrl(createdUrl);
        setPushToast(`Real playlist "${name}" created on your Spotify account!`);
        setTimeout(() => setPushToast(null), 6000);
        return true;
      }

      throw new Error('Failed to create playlist.');
    } catch (err: any) {
      console.error('Error creating real playlist:', err);
      setPushToast(`Error: ${err.message || 'Could not push to Spotify'}`);
      setTimeout(() => setPushToast(null), 5000);
      return false;
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Toast Notification */}
      {pushToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 text-zinc-100 text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{pushToast}</span>
        </div>
      )}

      {/* Header */}
      <Header
        spotifyUser={spotifyUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenPythonModal={() => setIsPythonModalOpen(true)}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Realtime Spotify Live Insights, Top Listens & History */}
        <SpotifyLiveInsights
          accessToken={accessToken}
          spotifyUser={spotifyUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSelectAsSeed={handleSelectTrackFromInsights}
          catalogTracks={tracks}
          onLoadRealCatalog={accessToken ? () => fetchRealCatalog(accessToken) : undefined}
        />

        {/* 1. Track Seed & Vibe Archetype Selection */}
        <TrackSeedSelector
          tracks={tracks}
          selectedSeedId={selectedSeedId}
          onSelectTrack={handleSelectTrack}
          onSelectPreset={handleSelectPreset}
          activePresetId={activePresetId}
          accessToken={accessToken}
          onAddCustomTrack={handleAddCustomTrack}
        />

        {/* 2. Mining Controls & Hyperparameter Tuning */}
        <MiningControls
          config={config}
          onChangeConfig={setConfig}
          targetFeatures={targetFeatures}
          onChangeFeatures={setTargetFeatures}
          onResetWeights={handleResetWeights}
          isCustomVibe={mode === 'custom'}
          onToggleMode={handleToggleMode}
        />

        {/* 3. Analytics & Visuals (PCA 2D Clustering & Audio Radar Chart) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* PCA 2D Clustering Projection */}
          <PCAScatterPlot
            points={pcaResult.points}
            explainedVariance={pcaResult.explainedVariance}
            seedTrackId={mode === 'seed' ? selectedSeedId : undefined}
            onSelectTrack={handleSelectTrack}
            recommendedIds={recommendedIds}
          />

          {/* Audio Profile Radar Chart */}
          <AudioRadarChart
            seedFeatures={targetFeatures}
            seedTitle={
              mode === 'seed'
                ? currentSeedTrack?.name || 'Seed Track'
                : activePresetId
                ? VIBE_PRESETS.find((p) => p.id === activePresetId)?.name || 'Target Vibe'
                : 'Custom Vibe'
            }
            recommendations={recommendations}
            catalogStats={catalogStats}
          />
        </div>

        {/* 4. Mined Playlist Table & Direct Push */}
        <RecommendationsList
          recommendations={recommendations}
          seedTrack={currentSeedTrack}
          isCustomVibe={mode === 'custom'}
          metric={config.metric}
          spotifyUser={spotifyUser}
          onPushToSpotify={handlePushToSpotify}
          isPushing={isPushing}
          pushedUrl={pushedUrl}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Spotify Vibe Playlist Miner · Realtime Playback & High-Dimensional Vector Mining
          </p>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsPythonModalOpen(true)}
              className="text-zinc-400 hover:text-zinc-200 transition"
            >
              Streamlit Specs
            </button>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-zinc-400 hover:text-zinc-200 transition"
            >
              Spotify OAuth
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SpotifyAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        authStatus={authStatus}
        spotifyUser={spotifyUser}
        onConnectSuccess={(token, user) => {
          setAccessToken(token);
          setSpotifyUser(user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('spotify_access_token', token);
            localStorage.setItem('spotify_user', JSON.stringify(user));
          }
          fetchRealCatalog(token);
        }}
        onDisconnect={() => {
          setAccessToken(null);
          setSpotifyUser(null);
          setPushedUrl(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_user');
          }
        }}
      />

      <PythonPipelineModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
      />
    </div>
  );
}

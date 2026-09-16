import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radio,
  Clock,
  Flame,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Headphones,
  Disc,
  Volume2,
  Calendar,
  AlertCircle,
  TrendingUp,
  LogIn,
  Layers,
} from 'lucide-react';
import { SpotifyUser, Track } from '../types';

export interface SpotifyTrackItem {
  id: string;
  name: string;
  uri: string;
  durationMs: number;
  popularity?: number;
  externalUrl: string;
  artists: { id?: string; name: string }[];
  album: {
    id?: string;
    name: string;
    imageUrl: string;
  };
}

export interface RecentlyPlayedItem {
  playedAt: string;
  track: SpotifyTrackItem;
}

export interface TopTrackItem extends SpotifyTrackItem {
  rank: number;
}

export interface CurrentlyPlayingData {
  isPlaying: boolean;
  progressMs: number;
  track: SpotifyTrackItem | null;
}

interface SpotifyLiveInsightsProps {
  accessToken: string | null;
  spotifyUser: SpotifyUser | null;
  onOpenAuth: () => void;
  onSelectAsSeed?: (track: SpotifyTrackItem) => void;
  catalogTracks: Track[];
  onLoadRealCatalog?: () => void;
}

export const SpotifyLiveInsights: React.FC<SpotifyLiveInsightsProps> = ({
  accessToken,
  spotifyUser,
  onOpenAuth,
  onSelectAsSeed,
  catalogTracks,
  onLoadRealCatalog,
}) => {
  // Navigation tabs: realtime playing, most listened (top), recent history
  const [activeTab, setActiveTab] = useState<'realtime' | 'top' | 'recent'>('realtime');
  // Alterable timeline for Most Listened: short_term (4 weeks), medium_term (6 months), long_term (All-Time)
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('short_term');

  // Real data states
  const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlayingData | null>(null);
  const [topTracks, setTopTracks] = useState<TopTrackItem[]>([]);
  const [recentTracks, setRecentTracks] = useState<RecentlyPlayedItem[]>([]);

  // Loading & error states
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [isLoadingTop, setIsLoadingTop] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [needsScopeUpgrade, setNeedsScopeUpgrade] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-polling for realtime song
  const [autoPoll, setAutoPoll] = useState(true);
  const pollIntervalRef = useRef<any>(null);

  // Format milliseconds to mm:ss
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format relative timestamp for recently played
  const formatRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  // 1. Fetch Realtime Currently Playing Song from Spotify API
  const fetchCurrentlyPlaying = useCallback(async () => {
    if (!accessToken) {
      setCurrentlyPlaying(null);
      return;
    }

    setIsLoadingLive(true);
    setErrorMessage(null);

    try {
      let data: any = null;

      // Direct client fetch
      try {
        const directRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (directRes.status === 204) {
          setCurrentlyPlaying({ isPlaying: false, progressMs: 0, track: null });
          setIsLoadingLive(false);
          return;
        }

        if (directRes.status === 403) {
          setNeedsScopeUpgrade(true);
        }

        if (directRes.ok) {
          const raw = await directRes.json();
          if (raw && raw.item) {
            data = {
              success: true,
              isPlaying: raw.is_playing ?? false,
              progressMs: raw.progress_ms ?? 0,
              track: {
                id: raw.item.id,
                name: raw.item.name,
                uri: raw.item.uri,
                durationMs: raw.item.duration_ms,
                externalUrl: raw.item.external_urls?.spotify || `https://open.spotify.com/track/${raw.item.id}`,
                artists: raw.item.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
                album: {
                  id: raw.item.album?.id,
                  name: raw.item.album?.name,
                  imageUrl: raw.item.album?.images?.[0]?.url || '',
                },
              },
            };
          }
        }
      } catch (directErr) {
        console.warn('Direct live fetch failed, trying proxy:', directErr);
      }

      // Fallback to server endpoint
      if (!data) {
        const res = await fetch(`/api/spotify/currently-playing?accessToken=${encodeURIComponent(accessToken)}`);
        data = await res.json();
      }

      if (data?.needsScopeUpgrade) {
        setNeedsScopeUpgrade(true);
      }

      if (data?.success) {
        setCurrentlyPlaying({
          isPlaying: data.isPlaying,
          progressMs: data.progressMs || 0,
          track: data.track,
        });
      } else {
        setCurrentlyPlaying({ isPlaying: false, progressMs: 0, track: null });
      }
    } catch (err: any) {
      console.error('Error fetching currently playing track:', err);
    } finally {
      setIsLoadingLive(false);
    }
  }, [accessToken]);

  // 2. Fetch Most Listened (Top Tracks) with Alterable Timeline from Spotify
  const fetchTopTracks = useCallback(
    async (range: 'short_term' | 'medium_term' | 'long_term') => {
      if (!accessToken) {
        setTopTracks([]);
        return;
      }

      setIsLoadingTop(true);
      setErrorMessage(null);

      try {
        let items: TopTrackItem[] | null = null;

        // Try direct Spotify API first
        try {
          const directRes = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${range}&limit=25`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (directRes.status === 403) {
            setNeedsScopeUpgrade(true);
          }

          if (directRes.ok) {
            const raw = await directRes.json();
            items = (raw.items || []).map((t: any, idx: number) => ({
              rank: idx + 1,
              id: t.id,
              name: t.name,
              uri: t.uri,
              durationMs: t.duration_ms,
              popularity: t.popularity,
              externalUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
              artists: t.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
              album: {
                id: t.album?.id,
                name: t.album?.name,
                imageUrl: t.album?.images?.[0]?.url || '',
              },
            }));
          }
        } catch (directErr) {
          console.warn('Direct top tracks fetch failed, using proxy:', directErr);
        }

        // Fallback to server endpoint
        if (!items) {
          const res = await fetch(
            `/api/spotify/top-tracks?time_range=${range}&limit=25&accessToken=${encodeURIComponent(accessToken)}`
          );
          const data = await res.json();
          if (data?.needsScopeUpgrade) {
            setNeedsScopeUpgrade(true);
          }
          if (data?.success) {
            items = data.items;
          }
        }

        if (items) {
          setTopTracks(items);
        }
      } catch (err: any) {
        console.error('Error fetching top tracks:', err);
        setErrorMessage('Failed to fetch top tracks from Spotify.');
      } finally {
        setIsLoadingTop(false);
      }
    },
    [accessToken]
  );

  // 3. Fetch Recent Listens from Spotify API
  const fetchRecentTracks = useCallback(async () => {
    if (!accessToken) {
      setRecentTracks([]);
      return;
    }

    setIsLoadingRecent(true);
    setErrorMessage(null);

    try {
      let items: RecentlyPlayedItem[] | null = null;

      // Try direct Spotify API
      try {
        const directRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=25', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (directRes.status === 403) {
          setNeedsScopeUpgrade(true);
        }

        if (directRes.ok) {
          const raw = await directRes.json();
          items = (raw.items || []).map((item: any) => ({
            playedAt: item.played_at,
            track: {
              id: item.track.id,
              name: item.track.name,
              uri: item.track.uri,
              durationMs: item.track.duration_ms,
              popularity: item.track.popularity,
              externalUrl: item.track.external_urls?.spotify || `https://open.spotify.com/track/${item.track.id}`,
              artists: item.track.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
              album: {
                id: item.track.album?.id,
                name: item.track.album?.name,
                imageUrl: item.track.album?.images?.[0]?.url || '',
              },
            },
          }));
        }
      } catch (directErr) {
        console.warn('Direct recent tracks fetch failed, using proxy:', directErr);
      }

      // Fallback to server endpoint
      if (!items) {
        const res = await fetch(`/api/spotify/recently-played?limit=25&accessToken=${encodeURIComponent(accessToken)}`);
        const data = await res.json();
        if (data?.needsScopeUpgrade) {
          setNeedsScopeUpgrade(true);
        }
        if (data?.success) {
          items = data.items;
        }
      }

      if (items) {
        setRecentTracks(items);
      }
    } catch (err: any) {
      console.error('Error fetching recent listens:', err);
      setErrorMessage('Failed to fetch recent listens from Spotify.');
    } finally {
      setIsLoadingRecent(false);
    }
  }, [accessToken]);

  // Initial load when access token is present
  useEffect(() => {
    if (accessToken) {
      fetchCurrentlyPlaying();
      fetchTopTracks(timeRange);
      fetchRecentTracks();
    } else {
      setCurrentlyPlaying(null);
      setTopTracks([]);
      setRecentTracks([]);
    }
  }, [accessToken, fetchCurrentlyPlaying, fetchTopTracks, fetchRecentTracks, timeRange]);

  // Handle timeline changes
  const handleTimelineChange = (newRange: 'short_term' | 'medium_term' | 'long_term') => {
    setTimeRange(newRange);
    fetchTopTracks(newRange);
  };

  // Auto-polling effect for realtime song
  useEffect(() => {
    if (autoPoll && accessToken) {
      pollIntervalRef.current = setInterval(() => {
        fetchCurrentlyPlaying();
      }, 5000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [autoPoll, accessToken, fetchCurrentlyPlaying]);

  // Helper to handle mining from track
  const handleMineTrack = (track: SpotifyTrackItem) => {
    if (onSelectAsSeed) {
      onSelectAsSeed(track);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Spotify Real-Time Activity & History
            </h2>
            {accessToken ? (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {spotifyUser?.displayName || 'Connected'}
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500 font-mono">
                Disconnected
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Realtime song monitor, top listens across customizable timelines, and playback history.
          </p>
        </div>

        {/* Action & Sync Controls */}
        <div className="flex items-center gap-2">
          {!accessToken ? (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition flex items-center space-x-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Spotify</span>
            </button>
          ) : (
            <>
              {onLoadRealCatalog && (
                <button
                  onClick={onLoadRealCatalog}
                  className="px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-zinc-100 text-xs font-medium transition flex items-center space-x-1.5 border border-zinc-800/80 hover:border-zinc-700"
                  title="Sync all your real tracks into the catalog"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sync to Miner</span>
                </button>
              )}
              <button
                onClick={() => {
                  fetchCurrentlyPlaying();
                  if (activeTab === 'top') fetchTopTracks(timeRange);
                  if (activeTab === 'recent') fetchRecentTracks();
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition flex items-center space-x-1.5 border border-zinc-800/80 hover:border-zinc-700"
                title="Refresh Spotify Data"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isLoadingLive || isLoadingTop || isLoadingRecent ? 'animate-spin text-emerald-400' : ''
                  }`}
                />
                <span>Refresh</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scope Upgrade Notice if permissions need refreshing */}
      {needsScopeUpgrade && (
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>Additional permissions required for playback and listening history.</p>
          </div>
          <button
            onClick={onOpenAuth}
            className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-medium text-xs transition"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
          <button
            onClick={() => setActiveTab('realtime')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition ${
              activeTab === 'realtime'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Now Playing</span>
            {currentlyPlaying?.isPlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('top')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition ${
              activeTab === 'top'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Most Listened</span>
            {topTracks.length > 0 && (
              <span className="text-[10px] text-zinc-500 font-mono">({topTracks.length})</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('recent')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition ${
              activeTab === 'recent'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recent History</span>
            {recentTracks.length > 0 && (
              <span className="text-[10px] text-zinc-500 font-mono">({recentTracks.length})</span>
            )}
          </button>
        </div>

        {/* Timeline Alteration Controls (Active only when on 'Most Listened' tab) */}
        {activeTab === 'top' && (
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
            <span className="text-xs text-zinc-500 px-2 font-medium">Timeline:</span>
            <button
              onClick={() => handleTimelineChange('short_term')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition ${
                timeRange === 'short_term'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              4 Weeks
            </button>
            <button
              onClick={() => handleTimelineChange('medium_term')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition ${
                timeRange === 'medium_term'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => handleTimelineChange('long_term')}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition ${
                timeRange === 'long_term'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Time
            </button>
          </div>
        )}

        {/* Realtime Live Auto-polling toggle */}
        {activeTab === 'realtime' && accessToken && (
          <button
            onClick={() => setAutoPoll(!autoPoll)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition border ${
              autoPoll
                ? 'bg-zinc-950 border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoPoll ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span>{autoPoll ? 'Live Sync (5s)' : 'Sync Paused'}</span>
          </button>
        )}
      </div>

      {/* NOT CONNECTED STATE */}
      {!accessToken ? (
        <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
            <Headphones className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-zinc-200">Connect Spotify Account</h3>
            <p className="text-xs text-zinc-400">
              Access your real-time playback, top listened songs over alterable timelines, and recent history.
            </p>
          </div>
          <div className="pt-1">
            <button
              onClick={onOpenAuth}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition inline-flex items-center space-x-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Spotify</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: REALTIME SONG (NOW PLAYING) */}
          {activeTab === 'realtime' && (
            <div className="space-y-3">
              {currentlyPlaying?.track ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 min-w-0">
                      {/* Album Cover Art */}
                      <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                        {currentlyPlaying.track.album.imageUrl ? (
                          <img
                            src={currentlyPlaying.track.album.imageUrl}
                            alt={currentlyPlaying.track.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Disc className="w-6 h-6 animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Song & Artist Info */}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Now Playing</span>
                        </div>
                        <h3 className="text-base font-semibold text-zinc-100 truncate">
                          {currentlyPlaying.track.name}
                        </h3>
                        <p className="text-xs text-zinc-400 truncate">
                          {currentlyPlaying.track.artists.map((a) => a.name).join(', ')} <span className="text-zinc-600">·</span> {currentlyPlaying.track.album.name}
                        </p>
                      </div>
                    </div>

                    {/* Direct Action Buttons: Open on Spotify & Mine Vibe */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleMineTrack(currentlyPlaying.track!)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-medium transition flex items-center space-x-1.5 border border-zinc-800"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Use as Seed</span>
                      </button>

                      <a
                        href={currentlyPlaying.track.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition flex items-center space-x-1"
                      >
                        <span>Spotify</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Realtime Playback Progress Bar */}
                  {currentlyPlaying.track.durationMs > 0 && (
                    <div className="mt-4 pt-3 border-t border-zinc-850 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                        <span>{formatTime(currentlyPlaying.progressMs)}</span>
                        <span>{formatTime(currentlyPlaying.track.durationMs)}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              (currentlyPlaying.progressMs / currentlyPlaying.track.durationMs) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center space-y-2">
                  <p className="text-xs text-zinc-400">No active playback detected on your Spotify devices.</p>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      onClick={fetchCurrentlyPlaying}
                      className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-medium transition flex items-center space-x-1.5 border border-zinc-800"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Check Playback</span>
                    </button>
                    <a
                      href="https://open.spotify.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-medium transition flex items-center space-x-1 border border-zinc-800"
                    >
                      <span>Open Spotify</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MOST LISTENED (TOP TRACKS WITH ALTERABLE TIMELINE) */}
          {activeTab === 'top' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Top rotation tracks ({timeRange === 'short_term' ? '4 Weeks' : timeRange === 'medium_term' ? '6 Months' : 'All-Time'})
                </span>
                <span className="font-mono text-zinc-500 text-[11px]">{topTracks.length} tracks</span>
              </div>

              {isLoadingTop ? (
                <div className="py-10 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  <p className="text-xs text-zinc-400">Loading top tracks from Spotify...</p>
                </div>
              ) : topTracks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {topTracks.map((track) => (
                    <div
                      key={track.id}
                      className="p-2.5 rounded-xl bg-zinc-950/70 hover:bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Rank Badge */}
                        <span className="w-5 text-center font-mono text-xs text-zinc-500 shrink-0">
                          {track.rank}
                        </span>

                        {/* Album Art */}
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                          {track.album.imageUrl ? (
                            <img
                              src={track.album.imageUrl}
                              alt={track.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Disc className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        {/* Track info */}
                        <div className="min-w-0">
                          <h4 className="text-xs font-medium text-zinc-200 truncate group-hover:text-emerald-400 transition">
                            {track.name}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {track.artists.map((a) => a.name).join(', ')}
                          </p>
                        </div>
                      </div>

                      {/* Actions: Open in Spotify & Mine Vibe */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleMineTrack(track)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 transition"
                          title="Use as seed for mining"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={track.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 transition"
                          title="Open on Spotify"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center">
                  <p className="text-xs text-zinc-400">No tracks recorded for this timeline.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RECENT LISTENS (HISTORY) */}
          {activeTab === 'recent' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Recent listening history</span>
                <span className="font-mono text-zinc-500 text-[11px]">{recentTracks.length} tracks</span>
              </div>

              {isLoadingRecent ? (
                <div className="py-10 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  <p className="text-xs text-zinc-400">Fetching recent listens from Spotify...</p>
                </div>
              ) : recentTracks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {recentTracks.map((item, idx) => (
                    <div
                      key={`${item.track.id}-${idx}`}
                      className="p-2.5 rounded-xl bg-zinc-950/70 hover:bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Cover Art */}
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                          {item.track.album.imageUrl ? (
                            <img
                              src={item.track.album.imageUrl}
                              alt={item.track.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Disc className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        {/* Track Details & Timestamp */}
                        <div className="min-w-0">
                          <h4 className="text-xs font-medium text-zinc-200 truncate group-hover:text-emerald-400 transition">
                            {item.track.name}
                          </h4>
                          <div className="flex items-center space-x-1.5 text-[11px] text-zinc-400 truncate">
                            <span>{item.track.artists.map((a) => a.name).join(', ')}</span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-zinc-500 font-mono text-[10px]">{formatRelativeTime(item.playedAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions: Open on Spotify & Mine Vibe */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleMineTrack(item.track)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 transition"
                          title="Use as seed for mining"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={item.track.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 transition"
                          title="Open on Spotify"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center">
                  <p className="text-xs text-zinc-400">No recently played tracks found in your Spotify history.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

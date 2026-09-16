import React, { useState } from 'react';
import { Search, Sparkles, Check, ExternalLink, Radio, Flame, Clock, Loader2, ChevronDown, ChevronUp, Music2 } from 'lucide-react';
import { Track } from '../types';
import { VIBE_PRESETS } from '../data/tracks';

interface TrackSeedSelectorProps {
  tracks: Track[];
  selectedSeedId: string;
  onSelectTrack: (trackId: string) => void;
  onSelectPreset: (presetId: string) => void;
  activePresetId?: string;
  accessToken?: string | null;
  onAddCustomTrack?: (track: Track) => void;
}

export const TrackSeedSelector: React.FC<TrackSeedSelectorProps> = ({
  tracks,
  selectedSeedId,
  onSelectTrack,
  onSelectPreset,
  activePresetId,
  accessToken,
  onAddCustomTrack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingSpotify, setIsSearchingSpotify] = useState(false);
  const [spotifySearchResults, setSpotifySearchResults] = useState<Track[]>([]);
  const [isCatalogExpanded, setIsCatalogExpanded] = useState(false);

  // Search local tracks
  const filteredTracks = tracks.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      t.name.toLowerCase().includes(query) ||
      t.artist.toLowerCase().includes(query) ||
      t.album.toLowerCase().includes(query) ||
      t.genre.toLowerCase().includes(query)
    );
  });

  const activeSeed = tracks.find((t) => t.id === selectedSeedId);

  // Search Spotify Catalog via server API
  const handleSearchSpotify = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingSpotify(true);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}&limit=6`, {
        headers,
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks)) {
        setSpotifySearchResults(data.tracks);
      }
    } catch (e) {
      console.warn('Spotify search error:', e);
    } finally {
      setIsSearchingSpotify(false);
    }
  };

  const handleSelectSearchResult = (track: Track) => {
    if (onAddCustomTrack) {
      onAddCustomTrack(track);
    }
    onSelectTrack(track.id);
    setSpotifySearchResults([]);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
      {/* Top row: Section title & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Seed Song & Vibe Anchor
          </h2>
          <p className="text-xs text-zinc-400">
            Anchor your recommendation vector to a song or curated sonic archetype
          </p>
        </div>

        {/* Minimal Search Bar */}
        <div className="flex items-center gap-2 w-full sm:w-80">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, artist, or album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSpotify()}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition"
            />
          </div>
          <button
            onClick={handleSearchSpotify}
            disabled={isSearchingSpotify || !searchQuery.trim()}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700 transition shrink-0 flex items-center gap-1.5"
            title="Search Spotify Catalog"
          >
            {isSearchingSpotify ? <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> : <Search className="w-3 h-3" />}
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* Spotify Live Search Results Drawer */}
      {spotifySearchResults.length > 0 && (
        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Spotify Results ({spotifySearchResults.length}):
            </span>
            <button
              onClick={() => setSpotifySearchResults([])}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {spotifySearchResults.map((track) => (
              <button
                key={track.id}
                onClick={() => handleSelectSearchResult(track)}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/80 flex items-center space-x-2.5 text-left transition group"
              >
                <img
                  src={track.albumArt}
                  alt={track.name}
                  className="w-9 h-9 rounded-md object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-200 truncate group-hover:text-emerald-400 transition">
                    {track.name}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">{track.artist}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Curated Vibe Archetypes Pills */}
      <div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] text-zinc-500 shrink-0 font-medium mr-1">Vibe Archetypes:</span>
          {VIBE_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition flex items-center space-x-1.5 border ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Anchor Song Card */}
      {activeSeed && (
        <div className="p-3.5 bg-zinc-950 border border-zinc-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={activeSeed.albumArt}
                alt={activeSeed.name}
                className="w-12 h-12 rounded-lg object-cover border border-zinc-800"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                  Active Anchor
                </span>
                {activeSeed.source === 'realtime' && (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5" />
                    Now Playing
                  </span>
                )}
                {activeSeed.source === 'top_tracks' && (
                  <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-amber-400" />
                    Top Rotation
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 truncate">
                {activeSeed.name}
              </h3>
              <p className="text-xs text-zinc-400 truncate">
                {activeSeed.artist} <span className="text-zinc-600">·</span> {activeSeed.album}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60 shrink-0">
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase block">Tempo</span>
                <span className="text-zinc-200">{Math.round(activeSeed.features.tempo)} BPM</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase block">Energy</span>
                <span className="text-zinc-200">{Math.round(activeSeed.features.energy * 100)}%</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase block">Mood</span>
                <span className="text-zinc-200">{Math.round(activeSeed.features.valence * 100)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <a
                href={activeSeed.externalUrl || `https://open.spotify.com/track/${activeSeed.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 transition"
                title="Open track on Spotify"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setIsCatalogExpanded(!isCatalogExpanded)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-xs font-medium text-zinc-300 border border-zinc-800 flex items-center gap-1 transition"
                title="Browse more songs to anchor with"
              >
                <span>Browse</span>
                {isCatalogExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Song Catalog Grid */}
      {isCatalogExpanded && (
        <div className="pt-2 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Library Songs ({filteredTracks.length}):</span>
            <span className="text-[11px] text-zinc-500">Click any track to anchor</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
            {filteredTracks.map((track) => {
              const isSelected = track.id === selectedSeedId;
              return (
                <button
                  key={track.id}
                  onClick={() => onSelectTrack(track.id)}
                  className={`p-2 rounded-xl text-left border transition flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500'
                      : 'bg-zinc-950/60 border-zinc-800/70 hover:bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-zinc-900">
                    <img
                      src={track.albumArt}
                      alt={track.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <div className="text-xs font-medium text-zinc-200 truncate group-hover:text-emerald-400 transition">
                      {track.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">{track.artist}</div>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{Math.round(track.features.tempo)} BPM</span>
                    <span>{Math.round(track.features.energy * 100)}% E</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


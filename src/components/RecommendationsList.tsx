import React, { useState } from 'react';
import { Play, Pause, ExternalLink, Share2, Disc, ArrowUpRight, Check, Sparkles, Download, Layers } from 'lucide-react';
import { Recommendation, Track, SpotifyUser } from '../types';
import { CLUSTERS } from '../ml/miningEngine';
import confetti from 'canvas-confetti';

interface RecommendationsListProps {
  recommendations: Recommendation[];
  seedTrack?: Track;
  isCustomVibe: boolean;
  metric: string;
  spotifyUser: SpotifyUser | null;
  onPushToSpotify: (playlistName: string, description: string) => Promise<boolean>;
  isPushing: boolean;
  pushedUrl?: string | null;
  onOpenAuth: () => void;
}

export const RecommendationsList: React.FC<RecommendationsListProps> = ({
  recommendations,
  seedTrack,
  isCustomVibe,
  metric,
  spotifyUser,
  onPushToSpotify,
  isPushing,
  pushedUrl,
  onOpenAuth,
}) => {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  const defaultName = isCustomVibe
    ? 'Mined Vibe Flow · Algorithmic Selection'
    : `Vibe Mine · ${seedTrack ? seedTrack.name : 'Custom'} Affinity`;

  const activeName = playlistName || defaultName;

  // Aggregate stats
  const avgBpm = Math.round(
    recommendations.reduce((acc, r) => acc + r.track.features.tempo, 0) / (recommendations.length || 1)
  );
  const avgEnergy = Math.round(
    (recommendations.reduce((acc, r) => acc + r.track.features.energy, 0) / (recommendations.length || 1)) * 100
  );
  const avgValence = Math.round(
    (recommendations.reduce((acc, r) => acc + r.track.features.valence, 0) / (recommendations.length || 1)) * 100
  );

  const handlePush = async () => {
    const desc = `Algorithmic playlist mined via Spotify Vibe Playlist Miner using ${
      metric === 'cosine' ? 'Cosine Similarity' : 'k-NN Vector Matching'
    } on 9 standardized audio dimensions.`;

    const success = await onPushToSpotify(activeName, desc);
    if (success) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ['Rank', 'Title', 'Artist', 'Album', 'Similarity %', 'Cosine Sim', 'Distance', 'Cluster', 'Spotify URI'];
    const rows = recommendations.map((r) => [
      r.rank,
      `"${r.track.name.replace(/"/g, '""')}"`,
      `"${r.track.artist.replace(/"/g, '""')}"`,
      `"${r.track.album.replace(/"/g, '""')}"`,
      `${r.similarityScore}%`,
      r.cosineSimilarity,
      r.distance,
      `"${r.clusterName}"`,
      r.track.spotifyUri,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vibe_miner_playlist_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Top Banner & Push Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Mined Algorithmic Playlist
            </h3>
            <span className="text-xs text-zinc-500 font-mono">
              ({recommendations.length} tracks)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-zinc-400">
            <span>
              Mean Tempo: <strong className="text-zinc-200 font-mono font-normal">{avgBpm} BPM</strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              Energy: <strong className="text-zinc-200 font-mono font-normal">{avgEnergy}%</strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              Mood: <strong className="text-zinc-200 font-mono font-normal">{avgValence}%</strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 font-mono text-[11px]">
              {metric.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Action Buttons: Export & Push to Spotify */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-zinc-800/80 hover:border-zinc-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          {pushedUrl ? (
            <a
              href={pushedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Open in Spotify</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          ) : spotifyUser ? (
            <button
              onClick={handlePush}
              disabled={isPushing}
              className="flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition disabled:opacity-50"
            >
              <Disc className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
              <span>{isPushing ? 'Pushing...' : 'Push to Spotify'}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition"
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Connect Spotify to Push</span>
            </button>
          )}
        </div>
      </div>

      {/* Recommendations Table / Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 font-medium text-[11px]">
              <th className="py-2 pl-2 w-10">#</th>
              <th className="py-2 px-3">Title & Artist</th>
              <th className="py-2 px-3">Cluster</th>
              <th className="py-2 px-3 text-right">Similarity</th>
              <th className="py-2 px-3 hidden md:table-cell">Alignment</th>
              <th className="py-2 pr-2 text-right">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {recommendations.map((rec) => {
              const cluster = CLUSTERS[rec.cluster];
              const isPlaying = playingTrackId === rec.track.id;

              return (
                <tr
                  key={rec.track.id}
                  className="hover:bg-zinc-800/30 transition group"
                >
                  {/* Rank */}
                  <td className="py-2.5 pl-2 font-mono text-zinc-500 text-xs">
                    {rec.rank}
                  </td>

                  {/* Track Info */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-zinc-800 bg-zinc-950">
                        <img
                          src={rec.track.albumArt}
                          alt={rec.track.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setPlayingTrackId(isPlaying ? null : rec.track.id)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white"
                          title={isPlaying ? 'Pause snippet' : 'Preview track'}
                        >
                          {isPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current text-emerald-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>
                      </div>

                      <div className="overflow-hidden min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-zinc-200 truncate group-hover:text-emerald-400 transition">
                            {rec.track.name}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-[11px] truncate">
                          {rec.track.artist} <span className="text-zinc-600">·</span> <span className="text-zinc-500">{rec.track.album}</span>
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Vibe Cluster Badge */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                      style={{
                        backgroundColor: `${cluster?.color || '#a3a3a3'}10`,
                        borderColor: `${cluster?.color || '#a3a3a3'}30`,
                        color: cluster?.color || '#a3a3a3',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: cluster?.color }}
                      />
                      <span>{cluster?.label || rec.clusterName}</span>
                    </span>
                  </td>

                  {/* Similarity Score */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span className="font-mono text-xs text-emerald-400 font-medium">
                      {rec.similarityScore}%
                    </span>
                  </td>

                  {/* Feature Alignment */}
                  <td className="py-2.5 px-3 hidden md:table-cell">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-zinc-950 h-1 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${rec.similarityScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 truncate">
                        {rec.dominantFeature}
                      </span>
                    </div>
                  </td>

                  {/* Spotify Direct Link */}
                  <td className="py-2.5 pr-2 text-right whitespace-nowrap">
                    <a
                      href={`https://open.spotify.com/track/${rec.track.spotifyUri.replace('spotify:track:', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-zinc-500 hover:text-emerald-400 transition p-1 hover:bg-zinc-850 rounded"
                      title="Listen on Spotify"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

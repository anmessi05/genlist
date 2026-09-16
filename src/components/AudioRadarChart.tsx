import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Activity, Disc3 } from 'lucide-react';
import { AudioFeatures, Recommendation, Track } from '../types';
import { FEATURE_KEYS } from '../ml/miningEngine';

interface AudioRadarChartProps {
  seedFeatures: AudioFeatures;
  seedTitle?: string;
  recommendations: Recommendation[];
  catalogStats: { means: Record<string, number> };
}

export const AudioRadarChart: React.FC<AudioRadarChartProps> = ({
  seedFeatures,
  seedTitle = 'Target Vibe',
  recommendations,
  catalogStats,
}) => {
  // Compute playlist mean profile
  const playlistMeans: Record<string, number> = {};
  FEATURE_KEYS.forEach((key) => {
    if (recommendations.length > 0) {
      const sum = recommendations.reduce((acc, r) => acc + r.track.features[key], 0);
      playlistMeans[key] = sum / recommendations.length;
    } else {
      playlistMeans[key] = seedFeatures[key];
    }
  });

  // Prepare normalized 0-1 data points for radar axes
  const radarData = [
    {
      subject: 'Danceability',
      Seed: Number(seedFeatures.danceability.toFixed(2)),
      PlaylistAvg: Number(playlistMeans.danceability.toFixed(2)),
      GlobalBaseline: Number((catalogStats.means.danceability || 0.55).toFixed(2)),
    },
    {
      subject: 'Energy',
      Seed: Number(seedFeatures.energy.toFixed(2)),
      PlaylistAvg: Number(playlistMeans.energy.toFixed(2)),
      GlobalBaseline: Number((catalogStats.means.energy || 0.60).toFixed(2)),
    },
    {
      subject: 'Valence (Mood)',
      Seed: Number(seedFeatures.valence.toFixed(2)),
      PlaylistAvg: Number(playlistMeans.valence.toFixed(2)),
      GlobalBaseline: Number((catalogStats.means.valence || 0.48).toFixed(2)),
    },
    {
      subject: 'Tempo (BPM)',
      // Normalize tempo (50 to 200) to 0-1
      Seed: Number(Math.max(0, Math.min(1, (seedFeatures.tempo - 50) / 150)).toFixed(2)),
      PlaylistAvg: Number(Math.max(0, Math.min(1, (playlistMeans.tempo - 50) / 150)).toFixed(2)),
      GlobalBaseline: Number(Math.max(0, Math.min(1, ((catalogStats.means.tempo || 120) - 50) / 150)).toFixed(2)),
    },
    {
      subject: 'Acousticness',
      Seed: Number(seedFeatures.acousticness.toFixed(2)),
      PlaylistAvg: Number(playlistMeans.acousticness.toFixed(2)),
      GlobalBaseline: Number((catalogStats.means.acousticness || 0.32).toFixed(2)),
    },
    {
      subject: 'Instrumental',
      Seed: Number(seedFeatures.instrumentalness.toFixed(2)),
      PlaylistAvg: Number(playlistMeans.instrumentalness.toFixed(2)),
      GlobalBaseline: Number((catalogStats.means.instrumentalness || 0.18).toFixed(2)),
    },
    {
      subject: 'Loudness',
      // Normalize -30 dB to 0 dB to 0-1
      Seed: Number(Math.max(0, Math.min(1, (seedFeatures.loudness + 30) / 30)).toFixed(2)),
      PlaylistAvg: Number(Math.max(0, Math.min(1, (playlistMeans.loudness + 30) / 30)).toFixed(2)),
      GlobalBaseline: Number(Math.max(0, Math.min(1, ((catalogStats.means.loudness || -8) + 30) / 30)).toFixed(2)),
    },
  ];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Audio Profile Fingerprint
            </h3>
            <p className="text-xs text-zinc-400">
              Target vector vs mined playlist average vs catalog baseline
            </p>
          </div>
        </div>

        {/* Radar Chart Container */}
        <div className="w-full h-[320px] flex items-center justify-center pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 400 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 1]}
                tick={{ fill: '#52525b', fontSize: 9 }}
                stroke="#3f3f46"
              />
              
              {/* Global Catalog Baseline */}
              <Radar
                name="Baseline"
                dataKey="GlobalBaseline"
                stroke="#71717a"
                strokeDasharray="3 3"
                fill="#71717a"
                fillOpacity={0.05}
              />

              {/* Mined Playlist Average */}
              <Radar
                name="Playlist Mean"
                dataKey="PlaylistAvg"
                stroke="#38bdf8"
                strokeWidth={1.5}
                fill="#38bdf8"
                fillOpacity={0.2}
              />

              {/* Seed / Target Vector */}
              <Radar
                name={seedTitle}
                dataKey="Seed"
                stroke="#10b981"
                strokeWidth={2}
                fill="#10b981"
                fillOpacity={0.3}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#27272a',
                  borderRadius: '8px',
                  color: '#f4f4f5',
                  fontSize: '11px',
                }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: '8px',
                  fontSize: '11px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
        <span className="truncate">
          Anchored on: <strong className="text-zinc-200 font-normal">{seedTitle}</strong>
        </span>
        <span className="font-mono text-zinc-500 text-[11px]">
          {recommendations.length} Tracks Mined
        </span>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Layers, Info, CheckCircle2, Disc } from 'lucide-react';
import { PCAPoint, Track } from '../types';
import { CLUSTERS } from '../ml/miningEngine';

interface PCAScatterPlotProps {
  points: PCAPoint[];
  explainedVariance: [number, number];
  seedTrackId?: string;
  onSelectTrack: (trackId: string) => void;
  recommendedIds: Set<string>;
}

export const PCAScatterPlot: React.FC<PCAScatterPlotProps> = ({
  points,
  explainedVariance,
  seedTrackId,
  onSelectTrack,
  recommendedIds,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<PCAPoint | null>(null);
  const [activeClusters, setActiveClusters] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4])
  );

  // Calculate bounding box for responsive SVG coordinates
  const bounds = useMemo(() => {
    let minX = -3.5;
    let maxX = 3.5;
    let minY = -3.5;
    let maxY = 3.5;

    points.forEach((p) => {
      if (p.pc1 < minX) minX = p.pc1;
      if (p.pc1 > maxX) maxX = p.pc1;
      if (p.pc2 < minY) minY = p.pc2;
      if (p.pc2 > maxY) maxY = p.pc2;
    });

    const padX = (maxX - minX) * 0.12 || 1;
    const padY = (maxY - minY) * 0.12 || 1;

    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    };
  }, [points]);

  const width = 560;
  const height = 400;
  const padding = 45;

  const scaleX = (val: number) => {
    return padding + ((val - bounds.minX) / (bounds.maxX - bounds.minX)) * (width - 2 * padding);
  };

  const scaleY = (val: number) => {
    // Invert Y for SVG coordinates
    return height - padding - ((val - bounds.minY) / (bounds.maxY - bounds.minY)) * (height - 2 * padding);
  };

  const toggleCluster = (id: number) => {
    const next = new Set(activeClusters);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setActiveClusters(next);
  };

  const seedPoint = points.find((p) => p.trackId === seedTrackId);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
              2D Vector Space Projection (PCA)
            </h3>
            <p className="text-xs text-zinc-400">
              PC1 ({explainedVariance[0]}% var) vs PC2 ({explainedVariance[1]}% var)
            </p>
          </div>

          <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded-lg border border-zinc-800/80 self-start sm:self-auto">
            {(explainedVariance[0] + explainedVariance[1]).toFixed(1)}% Explained
          </span>
        </div>

        {/* Cluster Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 py-3">
          <span className="text-xs text-zinc-500 mr-1 font-medium">Clusters:</span>
          {CLUSTERS.map((c) => {
            const isActive = activeClusters.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCluster(c.id)}
                className={`text-xs px-2.5 py-0.5 rounded-full transition flex items-center space-x-1.5 border ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                    : 'bg-zinc-950/40 text-zinc-500 border-zinc-900 opacity-40'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ backgroundColor: c.color }}
                />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* SVG Scatter Plot */}
        <div className="relative bg-zinc-950 rounded-xl border border-zinc-800/80 p-1 overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto cursor-crosshair select-none"
          >
            {/* Grid & Axes */}
            <line
              x1={padding}
              y1={scaleY(0)}
              x2={width - padding}
              y2={scaleY(0)}
              stroke="#27272a"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1={scaleX(0)}
              y1={padding}
              x2={scaleX(0)}
              y2={height - padding}
              stroke="#27272a"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Axes Labels */}
            <text
              x={width - padding}
              y={scaleY(0) - 6}
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              PC1 →
            </text>
            <text
              x={scaleX(0) + 6}
              y={padding + 10}
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="start"
            >
              ↑ PC2
            </text>

            {/* Connection Rays from Seed to Top-k Recommendations */}
            {seedPoint &&
              points
                .filter((p) => recommendedIds.has(p.trackId) && activeClusters.has(p.cluster))
                .map((rec) => (
                  <line
                    key={`line-${rec.trackId}`}
                    x1={scaleX(seedPoint.pc1)}
                    y1={scaleY(seedPoint.pc2)}
                    x2={scaleX(rec.pc1)}
                    y2={scaleY(rec.pc2)}
                    stroke="#10b981"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                    strokeDasharray="3 3"
                  />
                ))}

            {/* Scatter Points */}
            {points
              .filter((p) => activeClusters.has(p.cluster))
              .map((p) => {
                const cx = scaleX(p.pc1);
                const cy = scaleY(p.pc2);
                const isSeed = p.trackId === seedTrackId;
                const isRec = recommendedIds.has(p.trackId);
                const clusterColor = CLUSTERS[p.cluster]?.color || '#a3a3a3';

                return (
                  <g
                    key={p.trackId}
                    onClick={() => onSelectTrack(p.trackId)}
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="cursor-pointer transition-transform"
                  >
                    {/* Seed Halo */}
                    {isSeed && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="12"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                    )}

                    {/* Recommendation Halo */}
                    {isRec && !isSeed && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="9"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeOpacity="0.7"
                      />
                    )}

                    {/* Main Dot */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSeed ? 6 : isRec ? 5 : 3.5}
                      fill={isSeed ? '#f59e0b' : clusterColor}
                      stroke={isSeed ? '#ffffff' : '#09090b'}
                      strokeWidth={1.5}
                      className="hover:scale-125 transition-transform"
                    />
                  </g>
                );
              })}
          </svg>

          {/* Interactive Hover Card Overlay */}
          {hoveredPoint && (
            <div className="absolute bottom-3 left-3 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 p-2.5 rounded-xl shadow-xl max-w-xs pointer-events-none flex items-center space-x-3 z-20">
              <img
                src={hoveredPoint.albumArt}
                alt={hoveredPoint.name}
                className="w-10 h-10 rounded-lg object-cover border border-zinc-800 shrink-0"
              />
              <div className="overflow-hidden min-w-0">
                <div className="flex items-center space-x-1.5">
                  <h4 className="text-xs font-semibold text-zinc-100 truncate">{hoveredPoint.name}</h4>
                  {hoveredPoint.trackId === seedTrackId && (
                    <span className="text-[9px] bg-amber-400 text-black px-1 rounded font-bold">
                      SEED
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 truncate">{hoveredPoint.artist}</p>
                <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-zinc-400">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: CLUSTERS[hoveredPoint.cluster]?.color }}
                  />
                  <span>{hoveredPoint.clusterName}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono">{Math.round(hoveredPoint.features.tempo)} BPM</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-zinc-300">Seed</span>
          </span>
          <span className="inline-flex items-center space-x-1 ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-300">Matches</span>
          </span>
        </span>
        <span className="text-[11px] text-zinc-500">Click dot to set as seed</span>
      </div>
    </div>
  );
};

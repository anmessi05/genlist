import React, { useState } from 'react';
import { Sliders, Cpu, Sparkles, ChevronDown, ChevronUp, RefreshCw, BarChart2 } from 'lucide-react';
import { AudioFeatures, FeatureKey, MiningConfig, SimilarityMetric, StandardizationMode } from '../types';
import { FEATURE_KEYS, FEATURE_METADATA, DEFAULT_WEIGHTS } from '../ml/miningEngine';

interface MiningControlsProps {
  config: MiningConfig;
  onChangeConfig: (newConfig: MiningConfig) => void;
  targetFeatures: AudioFeatures;
  onChangeFeatures: (features: AudioFeatures) => void;
  onResetWeights: () => void;
  isCustomVibe: boolean;
  onToggleMode: (mode: 'seed' | 'custom') => void;
}

export const MiningControls: React.FC<MiningControlsProps> = ({
  config,
  onChangeConfig,
  targetFeatures,
  onChangeFeatures,
  onResetWeights,
  isCustomVibe,
  onToggleMode,
}) => {
  const [showWeights, setShowWeights] = useState(false);

  const handleMetricChange = (metric: SimilarityMetric) => {
    onChangeConfig({ ...config, metric });
  };

  const handleKChange = (k: number) => {
    onChangeConfig({ ...config, k });
  };

  const handleStandardizationChange = (standardization: StandardizationMode) => {
    onChangeConfig({ ...config, standardization });
  };

  const handleWeightChange = (key: FeatureKey, val: number) => {
    onChangeConfig({
      ...config,
      weights: {
        ...config.weights,
        [key]: val,
      },
    });
  };

  const handleFeatureSlider = (key: FeatureKey, val: number) => {
    onChangeFeatures({
      ...targetFeatures,
      [key]: val,
    });
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Algorithm & Feature Hyperparameters
          </h2>
          <p className="text-xs text-zinc-400">
            Configure vector distance metric, sample size, normalization, and weights
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
          <button
            onClick={() => onToggleMode('seed')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              !isCustomVibe
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Seed Track Anchor
          </button>
          <button
            onClick={() => onToggleMode('custom')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              isCustomVibe
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Attribute Synthesizer
          </button>
        </div>
      </div>

      {/* Mining Parameters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric Selector */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Distance Metric
          </label>
          <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
            <button
              onClick={() => handleMetricChange('cosine')}
              className={`py-1 px-2 text-xs font-medium rounded-lg text-center transition ${
                config.metric === 'cosine'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Cosine
            </button>
            <button
              onClick={() => handleMetricChange('euclidean')}
              className={`py-1 px-2 text-xs font-medium rounded-lg text-center transition ${
                config.metric === 'euclidean'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Euclidean
            </button>
            <button
              onClick={() => handleMetricChange('manhattan')}
              className={`py-1 px-2 text-xs font-medium rounded-lg text-center transition ${
                config.metric === 'manhattan'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Manhattan
            </button>
          </div>
        </div>

        {/* k Recommendations Slider */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-medium text-zinc-400">
              Recommendations Count
            </label>
            <span className="text-xs font-mono text-zinc-300">k = {config.k}</span>
          </div>
          <div className="flex items-center space-x-3 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800/80">
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={config.k}
              onChange={(e) => handleKChange(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
          </div>
        </div>

        {/* Standardization Toggle */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Vector Normalization
          </label>
          <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80">
            <button
              onClick={() => handleStandardizationChange('zscore')}
              className={`py-1 px-2 text-xs font-medium rounded-lg text-center transition ${
                config.standardization === 'zscore'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Z-Score (μ=0, σ=1)
            </button>
            <button
              onClick={() => handleStandardizationChange('minmax')}
              className={`py-1 px-2 text-xs font-medium rounded-lg text-center transition ${
                config.standardization === 'minmax'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Min-Max [0, 1]
            </button>
          </div>
        </div>
      </div>

      {/* Custom Vibe Synthesizer Sliders (Visible when mode === 'custom') */}
      {isCustomVibe && (
        <div className="mt-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <h3 className="text-xs font-semibold text-zinc-200">
                Target Audio Attributes
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">
              Synthesize an idealized target vector
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {FEATURE_KEYS.map((key) => {
              const meta = FEATURE_METADATA[key];
              const val = targetFeatures[key];
              const isInt = key === 'tempo' || key === 'loudness';
              const displayVal = isInt ? Math.round(val) : val.toFixed(2);

              return (
                <div key={key} className="bg-zinc-900/70 p-2.5 rounded-lg border border-zinc-800/60">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-zinc-400">{meta.label}</span>
                    <span className="font-mono text-zinc-200 text-xs">
                      {displayVal} {meta.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={meta.min}
                    max={meta.max}
                    step={key === 'tempo' ? 1 : key === 'loudness' ? 0.5 : 0.01}
                    value={val}
                    onChange={(e) => handleFeatureSlider(key, Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1 bg-zinc-800 rounded-lg"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature Weighting Drawer Toggle */}
      <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
        <button
          onClick={() => setShowWeights(!showWeights)}
          className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Dimension Weights (w<sub>j</sub>)</span>
          {showWeights ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showWeights && (
          <button
            onClick={onResetWeights}
            className="flex items-center space-x-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {showWeights && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
          {FEATURE_KEYS.map((key) => (
            <div key={key} className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/70">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-400 truncate">{FEATURE_METADATA[key].label}</span>
                <span className="font-mono text-zinc-200">{config.weights[key].toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.1}
                value={config.weights[key]}
                onChange={(e) => handleWeightChange(key, Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1 bg-zinc-800"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

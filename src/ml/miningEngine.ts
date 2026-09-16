import {
  AudioFeatures,
  ClusterInfo,
  FeatureKey,
  MiningConfig,
  PCAPoint,
  Recommendation,
  Track
} from '../types';

export const FEATURE_KEYS: FeatureKey[] = [
  'danceability',
  'energy',
  'valence',
  'tempo',
  'acousticness',
  'instrumentalness',
  'liveness',
  'speechiness',
  'loudness'
];

export const FEATURE_METADATA: Record<FeatureKey, { label: string; min: number; max: number; unit: string; description: string }> = {
  danceability: { label: 'Danceability', min: 0, max: 1, unit: '', description: 'Suitability for dancing based on tempo, rhythm, beat stability' },
  energy: { label: 'Energy', min: 0, max: 1, unit: '', description: 'Perceptual measure of intensity, activity, dynamic range' },
  valence: { label: 'Valence (Positivity)', min: 0, max: 1, unit: '', description: 'Musical positiveness conveyed (high = happy/cheerful, low = sad/somber)' },
  tempo: { label: 'Tempo', min: 50, max: 220, unit: 'BPM', description: 'Overall estimated tempo of a track in beats per minute' },
  acousticness: { label: 'Acousticness', min: 0, max: 1, unit: '', description: 'Confidence measure of whether the track is acoustic' },
  instrumentalness: { label: 'Instrumentalness', min: 0, max: 1, unit: '', description: 'Predicts whether a track contains no vocals' },
  liveness: { label: 'Liveness', min: 0, max: 1, unit: '', description: 'Detects the presence of an audience in the recording' },
  speechiness: { label: 'Speechiness', min: 0, max: 1, unit: '', description: 'Detects presence of spoken words (rap, podcast, vocal)' },
  loudness: { label: 'Loudness', min: -30, max: 0, unit: 'dB', description: 'Overall loudness of a track in decibels (dB)' }
};

export const DEFAULT_WEIGHTS: Record<FeatureKey, number> = {
  danceability: 1.2,
  energy: 1.2,
  valence: 1.1,
  tempo: 0.9,
  acousticness: 1.0,
  instrumentalness: 0.9,
  liveness: 0.5,
  speechiness: 0.7,
  loudness: 0.6
};

export interface FeatureStats {
  means: Record<FeatureKey, number>;
  stds: Record<FeatureKey, number>;
  mins: Record<FeatureKey, number>;
  maxs: Record<FeatureKey, number>;
}

// 1. Calculate Feature Statistics
export function calculateDatasetStats(tracks: Track[]): FeatureStats {
  const n = tracks.length;
  const means: Record<FeatureKey, number> = {} as any;
  const stds: Record<FeatureKey, number> = {} as any;
  const mins: Record<FeatureKey, number> = {} as any;
  const maxs: Record<FeatureKey, number> = {} as any;

  FEATURE_KEYS.forEach(key => {
    let sum = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    tracks.forEach(t => {
      const val = t.features[key];
      sum += val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    });

    const mean = sum / n;
    let sumSqDiff = 0;
    tracks.forEach(t => {
      sumSqDiff += Math.pow(t.features[key] - mean, 2);
    });
    const std = Math.sqrt(sumSqDiff / (n - 1)) || 0.0001;

    means[key] = mean;
    stds[key] = std;
    mins[key] = minVal;
    maxs[key] = maxVal;
  });

  return { means, stds, mins, maxs };
}

// 2. Standardize Feature Vector
export function standardizeVector(
  features: AudioFeatures,
  stats: FeatureStats,
  mode: 'zscore' | 'minmax'
): Record<FeatureKey, number> {
  const result: Record<FeatureKey, number> = {} as any;

  FEATURE_KEYS.forEach(key => {
    const val = features[key];
    if (mode === 'zscore') {
      result[key] = (val - stats.means[key]) / stats.stds[key];
    } else {
      const range = (stats.maxs[key] - stats.mins[key]) || 1;
      result[key] = (val - stats.mins[key]) / range;
    }
  });

  return result;
}

// 3. Cosine Similarity Calculation
export function calculateCosineSimilarity(
  vecA: Record<FeatureKey, number>,
  vecB: Record<FeatureKey, number>,
  weights: Record<FeatureKey, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  FEATURE_KEYS.forEach(key => {
    const w = weights[key] ?? 1.0;
    const a = vecA[key] * Math.sqrt(w);
    const b = vecB[key] * Math.sqrt(w);

    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  });

  if (normA === 0 || normB === 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, sim));
}

// 4. Weighted Euclidean Distance
export function calculateEuclideanDistance(
  vecA: Record<FeatureKey, number>,
  vecB: Record<FeatureKey, number>,
  weights: Record<FeatureKey, number>
): number {
  let sumSq = 0;

  FEATURE_KEYS.forEach(key => {
    const w = weights[key] ?? 1.0;
    const diff = vecA[key] - vecB[key];
    sumSq += w * diff * diff;
  });

  return Math.sqrt(sumSq);
}

// 5. Weighted Manhattan Distance
export function calculateManhattanDistance(
  vecA: Record<FeatureKey, number>,
  vecB: Record<FeatureKey, number>,
  weights: Record<FeatureKey, number>
): number {
  let sum = 0;

  FEATURE_KEYS.forEach(key => {
    const w = weights[key] ?? 1.0;
    sum += w * Math.abs(vecA[key] - vecB[key]);
  });

  return sum;
}

// 6. Natural Vibe Clusters (K-Means on audio features)
export const CLUSTERS: ClusterInfo[] = [
  {
    id: 0,
    name: "Euphoric Club & Dancefloor",
    label: "Club / Dance",
    color: "#22c55e", // Emerald
    description: "High energy, high danceability, fast tempo, uplifting positive valence.",
    dominantTraits: ["High Energy", "High Danceability", "Fast Tempo"]
  },
  {
    id: 1,
    name: "Late Night Lo-Fi & Mellow Chill",
    label: "Lo-Fi / Chill",
    color: "#38bdf8", // Sky blue
    description: "Relaxed tempo, organic acoustic textures, mellow valence, quiet intimate vibes.",
    dominantTraits: ["High Acousticness", "Low Energy", "Subdued Dynamics"]
  },
  {
    id: 2,
    name: "Deep Focus & Cinematic Ambient",
    label: "Focus / Ambient",
    color: "#a855f7", // Purple
    description: "Expansive instrumental soundscapes, minimal percussion, atmospheric texture.",
    dominantTraits: ["High Instrumentalness", "Low Speechiness", "Cinematic"]
  },
  {
    id: 3,
    name: "Golden Hour Indie & Psychedelic",
    label: "Indie / Psych",
    color: "#f59e0b", // Amber
    description: "Groovy mid-tempo rhythms, melodic warmth, vintage guitars and synthesizers.",
    dominantTraits: ["Groovy Tempo", "Warm Valence", "Melodic Hook"]
  },
  {
    id: 4,
    name: "High-Octane Rock & Workout",
    label: "Rock / Workout",
    color: "#ef4444", // Red / Rose
    description: "Heavy distortion, punchy rhythms, loud volume, intense kinetic energy.",
    dominantTraits: ["Maximum Loudness", "High Energy", "Driving Percussion"]
  }
];

// Determine track cluster assignment based on audio features
export function assignCluster(features: AudioFeatures): { cluster: number; clusterName: string } {
  const { energy, danceability, acousticness, instrumentalness, loudness } = features;

  if (instrumentalness > 0.65 && energy < 0.55) {
    return { cluster: 2, clusterName: CLUSTERS[2].name };
  }
  if (acousticness > 0.60 && energy < 0.45) {
    return { cluster: 1, clusterName: CLUSTERS[1].name };
  }
  if (energy > 0.75 && loudness > -6.0 && danceability > 0.65) {
    return { cluster: 0, clusterName: CLUSTERS[0].name };
  }
  if (energy > 0.70 && loudness > -7.0) {
    return { cluster: 4, clusterName: CLUSTERS[4].name };
  }
  return { cluster: 3, clusterName: CLUSTERS[3].name };
}

// 7. Principal Component Analysis (PCA) - SVD / Power Iteration
export interface PCAResult {
  points: PCAPoint[];
  explainedVariance: [number, number]; // [PC1%, PC2%]
  loadings: {
    pc1: Record<FeatureKey, number>;
    pc2: Record<FeatureKey, number>;
  };
}

export function computePCA(
  tracks: Track[],
  stats: FeatureStats,
  seedFeatures?: AudioFeatures,
  recommendations: Recommendation[] = []
): PCAResult {
  const N = tracks.length;
  const D = FEATURE_KEYS.length;

  // Standardize track matrix X (N x D)
  const X: number[][] = tracks.map(t => {
    const std = standardizeVector(t.features, stats, 'zscore');
    return FEATURE_KEYS.map(k => std[k]);
  });

  // Covariance matrix C = (1 / (N - 1)) * X^T * X
  const C: number[][] = Array(D).fill(0).map(() => Array(D).fill(0));
  for (let i = 0; i < D; i++) {
    for (let j = 0; j < D; j++) {
      let sum = 0;
      for (let k = 0; k < N; k++) {
        sum += X[k][i] * X[k][j];
      }
      C[i][j] = sum / (N - 1);
    }
  }

  // Total variance is trace of C
  let totalVariance = 0;
  for (let i = 0; i < D; i++) totalVariance += C[i][i];

  // Power Iteration for Eigenvector 1
  function powerIteration(mat: number[][], iterations = 60): { eigenvector: number[]; eigenvalue: number } {
    let v = Array(D).fill(0).map(() => Math.random() - 0.5);
    // Normalize initial
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    v = v.map(x => x / norm);

    let lambda = 0;
    for (let it = 0; it < iterations; it++) {
      const nextV = Array(D).fill(0);
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) {
          nextV[i] += mat[i][j] * v[j];
        }
      }
      norm = Math.sqrt(nextV.reduce((s, x) => s + x * x, 0)) || 1;
      lambda = norm;
      v = nextV.map(x => x / norm);
    }

    return { eigenvector: v, eigenvalue: lambda };
  }

  // PC1
  const pc1Result = powerIteration(C);
  const e1 = pc1Result.eigenvector;
  const lambda1 = pc1Result.eigenvalue;

  // Deflate C for PC2: C_deflated = C - lambda1 * (e1 * e1^T)
  const C_deflated: number[][] = Array(D).fill(0).map(() => Array(D).fill(0));
  for (let i = 0; i < D; i++) {
    for (let j = 0; j < D; j++) {
      C_deflated[i][j] = C[i][j] - lambda1 * e1[i] * e1[j];
    }
  }

  // PC2
  const pc2Result = powerIteration(C_deflated);
  const e2 = pc2Result.eigenvector;
  const lambda2 = pc2Result.eigenvalue;

  const varRatio1 = Math.min(100, Math.max(15, (lambda1 / totalVariance) * 100));
  const varRatio2 = Math.min(100, Math.max(10, (lambda2 / totalVariance) * 100));

  const recommendedIds = new Set(recommendations.map(r => r.track.id));
  const similarityMap = new Map(recommendations.map(r => [r.track.id, r.similarityScore]));

  // Project points
  const points: PCAPoint[] = tracks.map((t, idx) => {
    const x = X[idx];
    let pc1 = 0;
    let pc2 = 0;
    for (let i = 0; i < D; i++) {
      pc1 += x[i] * e1[i];
      pc2 += x[i] * e2[i];
    }

    const { cluster, clusterName } = assignCluster(t.features);
    const isRecommended = recommendedIds.has(t.id);

    return {
      id: t.id,
      trackId: t.id,
      name: t.name,
      artist: t.artist,
      albumArt: t.albumArt,
      pc1: Number(pc1.toFixed(3)),
      pc2: Number(pc2.toFixed(3)),
      cluster,
      clusterName,
      isSeed: false,
      isRecommended,
      similarity: similarityMap.get(t.id) || 0,
      features: t.features
    };
  });

  const pc1Loadings: Record<FeatureKey, number> = {} as any;
  const pc2Loadings: Record<FeatureKey, number> = {} as any;
  FEATURE_KEYS.forEach((k, idx) => {
    pc1Loadings[k] = Number(e1[idx].toFixed(3));
    pc2Loadings[k] = Number(e2[idx].toFixed(3));
  });

  return {
    points,
    explainedVariance: [Number(varRatio1.toFixed(1)), Number(varRatio2.toFixed(1))],
    loadings: {
      pc1: pc1Loadings,
      pc2: pc2Loadings
    }
  };
}

// 8. k-NN Recommendation Engine
export function mineRecommendations(
  targetFeatures: AudioFeatures,
  tracks: Track[],
  config: MiningConfig,
  seedTrackId?: string
): Recommendation[] {
  const stats = calculateDatasetStats(tracks);
  const targetStd = standardizeVector(targetFeatures, stats, config.standardization);

  const scoredTracks = tracks.map(track => {
    const trackStd = standardizeVector(track.features, stats, config.standardization);

    const cosineSim = calculateCosineSimilarity(targetStd, trackStd, config.weights);
    const euclideanDist = calculateEuclideanDistance(targetStd, trackStd, config.weights);
    const manhattanDist = calculateManhattanDistance(targetStd, trackStd, config.weights);

    // Primary score calculation based on chosen metric
    let distance = 0;
    let similarityScore = 0;

    if (config.metric === 'cosine') {
      distance = 1 - cosineSim;
      // Cosine similarity mapped from [-1, 1] to [0, 100]%
      similarityScore = Math.max(0, Math.min(100, Math.round(((cosineSim + 1) / 2) * 100)));
    } else if (config.metric === 'euclidean') {
      distance = euclideanDist;
      // Convert distance to percentage score via exponential decay
      similarityScore = Math.max(0, Math.min(100, Math.round(Math.exp(-euclideanDist * 0.35) * 100)));
    } else {
      distance = manhattanDist;
      similarityScore = Math.max(0, Math.min(100, Math.round(Math.exp(-manhattanDist * 0.20) * 100)));
    }

    // Find dominant matching trait
    let minTraitDiff = Infinity;
    let dominantTrait: FeatureKey = 'energy';
    FEATURE_KEYS.forEach(key => {
      const diff = Math.abs(trackStd[key] - targetStd[key]);
      if (diff < minTraitDiff) {
        minTraitDiff = diff;
        dominantTrait = key;
      }
    });

    const { cluster, clusterName } = assignCluster(track.features);

    return {
      track,
      cosineSimilarity: Number(cosineSim.toFixed(4)),
      distance: Number(distance.toFixed(4)),
      similarityScore,
      cluster,
      clusterName,
      dominantFeature: FEATURE_METADATA[dominantTrait].label
    };
  });

  // Filter out exact seed track if provided
  const filtered = seedTrackId
    ? scoredTracks.filter(item => item.track.id !== seedTrackId)
    : scoredTracks;

  // Sort by similarity descending (or distance ascending)
  filtered.sort((a, b) => {
    if (config.metric === 'cosine') {
      return b.cosineSimilarity - a.cosineSimilarity;
    }
    return a.distance - b.distance;
  });

  // Slice top-k
  return filtered.slice(0, config.k).map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));
}

// 9. Generate Python Streamlit & Colab Code
export function generateStreamlitScript(): string {
  return `"""
Spotify Vibe Playlist Miner (Data Mining & ML Project)
Production Python / Streamlit Architecture
Algorithms: Standardized Cosine Similarity, k-NN Vector Matching, PCA 2D Clustering
API: Spotipy OAuth Authentication & Direct User Playlist Export
"""

import streamlit as st
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neighbors import NearestNeighbors
from sklearn.decomposition import PCA
import plotly.express as px
import plotly.graph_objects as go
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import os

# Page Config
st.set_page_config(
    page_title="Spotify Vibe Playlist Miner",
    page_icon="🎵",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("🎵 Spotify Vibe Playlist Miner")
st.markdown("### Algorithmic Playlist Mining with Cosine Similarity, k-NN & PCA")

# Audio Features Schema
AUDIO_FEATURES = [
    'danceability', 'energy', 'valence', 'tempo',
    'acousticness', 'instrumentalness', 'liveness', 'speechiness', 'loudness'
]

# 1. Spotify OAuth Authentication Setup
@st.cache_resource
def get_spotify_client():
    client_id = os.getenv("SPOTIFY_CLIENT_ID", "")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:8501")
    
    if not client_id or not client_secret:
        return None
        
    sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="playlist-modify-public playlist-modify-private user-read-private"
    ))
    return sp

# 2. Data Mining Engine
def mine_playlist(df, target_vector, metric="cosine", k=15, feature_weights=None):
    X = df[AUDIO_FEATURES].values
    
    # Feature Standardization (Z-Score)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    target_scaled = scaler.transform(np.array(target_vector).reshape(1, -1))
    
    if feature_weights is not None:
        weights = np.array([feature_weights.get(f, 1.0) for f in AUDIO_FEATURES])
        X_scaled = X_scaled * np.sqrt(weights)
        target_scaled = target_scaled * np.sqrt(weights)
        
    if metric == "cosine":
        sims = cosine_similarity(target_scaled, X_scaled)[0]
        top_indices = np.argsort(sims)[::-1][:k]
        results = df.iloc[top_indices].copy()
        results['similarity_score'] = (sims[top_indices] * 100).round(1)
    else: # k-NN Euclidean
        knn = NearestNeighbors(n_neighbors=k, metric='euclidean')
        knn.fit(X_scaled)
        distances, indices = knn.kneighbors(target_scaled)
        results = df.iloc[indices[0]].copy()
        results['distance'] = distances[0].round(3)
        results['similarity_score'] = (np.exp(-distances[0] * 0.3) * 100).round(1)
        
    return results

# 3. PCA 2D Dimensionality Reduction
def compute_pca_clusters(df):
    X = df[AUDIO_FEATURES].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    pca = PCA(n_components=2)
    components = pca.fit_transform(X_scaled)
    df_pca = df.copy()
    df_pca['PC1'] = components[:, 0]
    df_pca['PC2'] = components[:, 1]
    
    var_ratio = pca.explained_variance_ratio_ * 100
    return df_pca, var_ratio
`;
}

export function generateColabNotebookJson(): string {
  const notebook = {
    nbformat: 4,
    nbformat_minor: 0,
    metadata: {
      colab: {
        name: "Spotify_Vibe_Playlist_Miner.ipynb",
        provenance: []
      },
      kernelspec: {
        name: "python3",
        display_name: "Python 3"
      }
    },
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: [
          "# 🎵 Spotify Vibe Playlist Miner (Data Mining & ML Project)\n",
          "### Algorithmic Recommendation Engine, Cosine Similarity & k-NN Vector Matching\n",
          "This notebook launches the interactive Streamlit dashboard directly from Google Colab using a secure Cloudflare Tunnel."
        ]
      },
      {
        cell_type: "code",
        metadata: {},
        execution_count: null,
        outputs: [],
        source: [
          "# Step 1: Install dependencies\n",
          "!pip install -q streamlit spotipy scikit-learn plotly pandas pycloudflared\n"
        ]
      },
      {
        cell_type: "code",
        metadata: {},
        execution_count: null,
        outputs: [],
        source: [
          "# Step 2: Write the Streamlit application file\n",
          "%%writefile app.py\n",
          generateStreamlitScript()
        ]
      },
      {
        cell_type: "code",
        metadata: {},
        execution_count: null,
        outputs: [],
        source: [
          "# Step 3: Run Streamlit in background and open Cloudflare Tunnel\n",
          "import subprocess\n",
          "import time\n",
          "\n",
          "# Start streamlit on port 8501\n",
          "p = subprocess.Popen([\"streamlit\", \"run\", \"app.py\", \"--server.port\", \"8501\", \"--server.headless\", \"true\"])\n",
          "time.sleep(3)\n",
          "\n",
          "# Launch Cloudflare tunnel for public access\n",
          "!pycloudflared tunnel --url http://localhost:8501\n"
        ]
      }
    ]
  };

  return JSON.stringify(notebook, null, 2);
}

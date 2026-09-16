export interface AudioFeatures {
  danceability: number; // 0.0 to 1.0
  energy: number; // 0.0 to 1.0
  valence: number; // 0.0 to 1.0 (musical positivity)
  tempo: number; // BPM, 50 to 220
  acousticness: number; // 0.0 to 1.0
  instrumentalness: number; // 0.0 to 1.0
  liveness: number; // 0.0 to 1.0
  speechiness: number; // 0.0 to 1.0
  loudness: number; // -60.0 to 0.0 dB
}

export type FeatureKey = keyof AudioFeatures;

export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  spotifyUri: string;
  externalUrl?: string;
  popularity?: number;
  source?: 'realtime' | 'top_tracks' | 'recently_played' | 'catalog' | 'search';
  previewUrl?: string;
  genre: string;
  year: number;
  features: AudioFeatures;
}

export interface Recommendation {
  track: Track;
  rank: number;
  similarityScore: number; // 0 - 100%
  cosineSimilarity: number; // -1 to 1 or 0 to 1
  distance: number;
  cluster: number;
  clusterName: string;
  dominantFeature: string;
}

export interface ClusterInfo {
  id: number;
  name: string;
  label: string;
  color: string;
  description: string;
  dominantTraits: string[];
}

export interface PCAPoint {
  id: string;
  trackId: string;
  name: string;
  artist: string;
  albumArt: string;
  pc1: number;
  pc2: number;
  cluster: number;
  clusterName: string;
  isSeed: boolean;
  isRecommended: boolean;
  similarity: number;
  features: AudioFeatures;
}

export type SimilarityMetric = 'cosine' | 'euclidean' | 'manhattan';
export type StandardizationMode = 'zscore' | 'minmax';

export interface MiningConfig {
  metric: SimilarityMetric;
  k: number;
  standardization: StandardizationMode;
  weights: Record<FeatureKey, number>;
  vibePreset?: string;
}

export interface SpotifyAuthStatus {
  configured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  appUrl: string;
  redirectUri: string;
}

export interface SpotifyUser {
  id: string;
  displayName: string;
  email?: string;
  images?: Array<{ url: string }>;
}

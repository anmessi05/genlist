import React from 'react';
import { Code2, Disc, LogIn, ExternalLink, Music2 } from 'lucide-react';
import { SpotifyUser, SpotifyAuthStatus } from '../types';

interface HeaderProps {
  authStatus?: SpotifyAuthStatus | null;
  spotifyUser: SpotifyUser | null;
  onOpenAuth: () => void;
  onOpenPython: () => void;
  trackCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  spotifyUser,
  onOpenAuth,
  onOpenPython,
}) => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Music2 className="w-4 h-4" />
          </div>
          <div className="flex items-baseline space-x-2">
            <h1 className="font-semibold text-sm text-zinc-100 tracking-tight">
              Spotify Vibe Miner
            </h1>
            <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
              v2.4 · ML Vector Matching
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenPython}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
            title="View Python Colab & Streamlit Specs"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Python Specs</span>
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1 hidden sm:block" />

          {spotifyUser ? (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-full py-1 pl-1.5 pr-3 transition"
              title="Spotify Account Settings"
            >
              {spotifyUser.images?.[0]?.url ? (
                <img
                  src={spotifyUser.images[0].url}
                  alt={spotifyUser.displayName}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                  {spotifyUser.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              <span className="text-xs text-zinc-200 font-medium max-w-[120px] truncate">
                {spotifyUser.displayName}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition font-sans"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Spotify</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};


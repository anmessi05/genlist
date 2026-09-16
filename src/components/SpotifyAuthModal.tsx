import React, { useState } from 'react';
import { X, LogIn, ExternalLink, ShieldCheck, Key, Copy, Check, Sparkles, AlertCircle } from 'lucide-react';
import { SpotifyAuthStatus, SpotifyUser } from '../types';

interface SpotifyAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authStatus: SpotifyAuthStatus | null;
  onConnectSuccess: (token: string, user: SpotifyUser) => void;
  spotifyUser: SpotifyUser | null;
  onDisconnect: () => void;
}

export const SpotifyAuthModal: React.FC<SpotifyAuthModalProps> = ({
  isOpen,
  onClose,
  authStatus,
  onConnectSuccess,
  spotifyUser,
  onDisconnect,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentCallbackUrl = `${currentOrigin}/auth/callback`;
  const devCallbackUrl = 'https://ais-dev-tr44gur3m2j7cd24njqzit-504096130987.asia-east1.run.app/auth/callback';
  const sharedCallbackUrl = 'https://ais-pre-tr44gur3m2j7cd24njqzit-504096130987.asia-east1.run.app/auth/callback';

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleConnectOAuth = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const queryParams = new URLSearchParams({
        origin: currentOrigin,
        redirect_uri: currentCallbackUrl,
      });

      const res = await fetch(`/api/auth/url?${queryParams.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Spotify Developer Client ID not configured in environment.');
      }

      // Open OAuth popup directly to Spotify authorization URL
      const authWindow = window.open(
        data.url,
        'spotify_oauth_popup',
        'width=600,height=750,menubar=no,toolbar=no'
      );

      if (!authWindow) {
        throw new Error('Popup was blocked by your browser. Please enable popups for this site.');
      }

      // Window listener is already active in App.tsx or handled via callback
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Spotify login');
    } finally {
      setIsLoading(false);
    }
  };

  const [manualToken, setManualToken] = useState('');
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  const handleConnectManualToken = async () => {
    const token = manualToken.trim();
    if (!token) return;
    setIsValidatingToken(true);
    setErrorMessage(null);

    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Invalid or expired Spotify token. Please verify the token has user-read permissions.');
      }

      const meData = await res.json();
      const user: SpotifyUser = {
        id: meData.id,
        displayName: meData.display_name || 'Spotify User',
        email: meData.email || '',
        images: meData.images || [],
      };

      onConnectSuccess(token, user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate with provided token');
    } finally {
      setIsValidatingToken(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-black">
              <LogIn className="w-4 h-4 font-bold" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Spotify Account Integration</h3>
              <p className="text-xs text-neutral-400">Real OAuth 2.0 & Web API Connection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Active User State */}
          {spotifyUser ? (
            <div className="p-4 rounded-xl bg-neutral-950 border border-emerald-500/40 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {spotifyUser.images?.[0]?.url ? (
                  <img
                    src={spotifyUser.images[0].url}
                    alt={spotifyUser.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-emerald-500"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    {spotifyUser.displayName.charAt(0)}
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
                    Connected Real Account
                  </span>
                  <h4 className="text-sm font-bold text-white">{spotifyUser.displayName}</h4>
                  {spotifyUser.email && (
                    <p className="text-xs text-neutral-400">{spotifyUser.email}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onDisconnect}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/30 transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              {/* OAuth Connect Action */}
              <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-3">
                <h4 className="text-sm font-bold text-white mb-1">
                  Connect Directly to Your Real Spotify Account
                </h4>
                <p className="text-xs text-neutral-300 max-w-md mx-auto">
                  Log in to authorize real-time playback inspection, top listening analysis, and creation of real playlists in your Spotify library.
                </p>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start space-x-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="flex justify-center pt-1">
                  <button
                    onClick={handleConnectOAuth}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{isLoading ? 'Opening Spotify...' : 'Launch Spotify Login Popup'}</span>
                  </button>
                </div>

                {/* Direct Token Option */}
                <div className="pt-3 border-t border-neutral-800/80 text-left space-y-2">
                  <span className="text-[11px] font-semibold text-neutral-400 block">
                    Or paste an active Spotify OAuth Token:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="BQ... (Spotify OAuth Access Token)"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      onClick={handleConnectManualToken}
                      disabled={!manualToken.trim() || isValidatingToken}
                      className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-emerald-400 text-xs font-semibold border border-neutral-700 transition shrink-0"
                    >
                      {isValidatingToken ? 'Verifying...' : 'Connect'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Developer Configuration Setup Steps & Error Troubleshooting */}
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Fixing "redirect_uri: Not matching configuration":</span>
                  </div>
                  <p className="text-neutral-300 leading-relaxed text-[11px]">
                    Spotify's OAuth server checks the exact URL letter-for-letter. If the Redirect URI in your Spotify App Settings doesn't match, Spotify shows this error.
                  </p>
                  <div className="text-[11px] text-neutral-300 space-y-1 pl-1">
                    <p>1. Open your Spotify App (<strong className="text-white">genlist</strong>) in the <strong>Spotify Developer Dashboard</strong>.</p>
                    <p>2. Click <strong>Settings</strong>.</p>
                    <p>3. Under <strong>Redirect URIs</strong>, paste the URI below and click <strong>Add</strong>.</p>
                    <p>4. ⚠️ <strong>Important:</strong> Scroll down and click <strong>Save</strong> at the bottom of the Spotify page!</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  <span className="flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Your App's Required Redirect URIs</span>
                  </span>
                  <a
                    href="https://developer.spotify.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 underline inline-flex items-center space-x-1 text-[11px] normal-case"
                  >
                    <span>Open Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Primary Development Redirect URI */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 font-medium">1. Development Redirect URI (Active):</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">Recommended</span>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg p-2 font-mono text-[11px] text-emerald-400">
                    <span className="truncate mr-2 select-all">{devCallbackUrl}</span>
                    <button
                      onClick={() => handleCopy(devCallbackUrl, 'dev')}
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition shrink-0"
                      title="Copy URI"
                    >
                      {copiedKey === 'dev' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Shared / Production Redirect URI */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 font-medium">2. Shared / Preview Redirect URI:</span>
                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">Shared URL</span>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg p-2 font-mono text-[11px] text-sky-400">
                    <span className="truncate mr-2 select-all">{sharedCallbackUrl}</span>
                    <button
                      onClick={() => handleCopy(sharedCallbackUrl, 'shared')}
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition shrink-0"
                      title="Copy URI"
                    >
                      {copiedKey === 'shared' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400">
                  <span className="text-neutral-200 font-medium">💡 Developer Mode tip:</span> In Spotify Developer Dashboard, apps remain in Development Mode by default. Ensure the Spotify account you sign in with is either the app creator or added under <strong className="text-neutral-200">Users and Access</strong>.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Protected via Spotify OAuth 2.0 PKCE / Authorization Code</span>
          <button onClick={onClose} className="hover:text-white transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

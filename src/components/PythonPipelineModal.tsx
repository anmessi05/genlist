import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, Code2, BookOpen, ExternalLink, Cloud, Cpu } from 'lucide-react';
import { generateStreamlitScript, generateColabNotebookJson } from '../ml/miningEngine';

interface PythonPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonPipelineModal: React.FC<PythonPipelineModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'streamlit' | 'colab' | 'math'>('streamlit');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const streamlitCode = generateStreamlitScript();
  const colabJson = generateColabNotebookJson();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPy = () => {
    const blob = new Blob([streamlitCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadIpynb = () => {
    const blob = new Blob([colabJson], { type: 'application/x-ipynb+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spotify_vibe_playlist_miner.ipynb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Terminal className="w-4 h-4 font-bold" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Python, Streamlit & Google Colab Pipeline
              </h3>
              <p className="text-xs text-neutral-400">
                Cloud Ready Deployment with Spotipy & Cloudflare Tunnel
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'streamlit' && (
              <>
                <button
                  onClick={() => handleCopy(streamlitCode)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Python Code'}</span>
                </button>
                <button
                  onClick={handleDownloadPy}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download app.py</span>
                </button>
              </>
            )}

            {activeTab === 'colab' && (
              <button
                onClick={handleDownloadIpynb}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ipynb</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('streamlit')}
            className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'streamlit'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Python Streamlit App (app.py)</span>
          </button>
          <button
            onClick={() => setActiveTab('colab')}
            className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'colab'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Google Colab & Cloudflare Tunnel</span>
          </button>
          <button
            onClick={() => setActiveTab('math')}
            className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'math'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Data Mining Mathematics</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
          {activeTab === 'streamlit' && (
            <div className="space-y-4">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-[11px] font-sans text-neutral-300 flex items-center justify-between">
                <span>
                  Dependencies: <code className="text-emerald-400">pip install streamlit spotipy scikit-learn plotly pandas</code>
                </span>
                <span className="text-neutral-500 font-mono">Run: streamlit run app.py</span>
              </div>
              <pre className="p-4 bg-neutral-950 text-neutral-200 rounded-xl border border-neutral-800 overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin">
                {streamlitCode}
              </pre>
            </div>
          )}

          {activeTab === 'colab' && (
            <div className="font-sans space-y-4">
              <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 text-xs">
                <h4 className="font-bold text-white mb-1 flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-sky-400" />
                  <span>Colab Cloudflare Tunnel Architecture</span>
                </h4>
                <p className="text-neutral-300 leading-relaxed">
                  To deploy on Google Colab, we install <code className="text-sky-400 font-mono">pycloudflared</code>, start Streamlit in the background, and expose a secure HTTPS tunnel link directly to the internet without opening firewalls or port forwards.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <h5 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
                  Colab Notebook Execution Steps:
                </h5>
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-[11px] text-neutral-300 space-y-2">
                  <p className="text-neutral-500"># Cell 1: Install required packages</p>
                  <p className="text-emerald-400">!pip install -q streamlit spotipy scikit-learn plotly pandas pycloudflared</p>
                  
                  <p className="text-neutral-500 pt-2"># Cell 2: Save Streamlit App</p>
                  <p className="text-amber-400">%%writefile app.py</p>
                  <p className="text-neutral-400"># (Copy contents from the app.py tab)</p>

                  <p className="text-neutral-500 pt-2"># Cell 3: Start Streamlit and Tunnel</p>
                  <p className="text-emerald-400">import subprocess, time</p>
                  <p className="text-emerald-400">p = subprocess.Popen(["streamlit", "run", "app.py", "--server.port", "8501", "--server.headless", "true"])</p>
                  <p className="text-emerald-400">time.sleep(3)</p>
                  <p className="text-emerald-400">!pycloudflared tunnel --url http://localhost:8501</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'math' && (
            <div className="font-sans space-y-5 text-xs text-neutral-300">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <h4 className="font-bold text-white text-sm mb-1.5">
                  1. Feature Standardization (Z-Score Normalization)
                </h4>
                <p className="text-neutral-400 mb-2">
                  To prevent high-magnitude features (e.g. Tempo 50-200 BPM or Loudness -60 to 0 dB) from dominating dimensionless ratios (e.g. Danceability 0.0-1.0), each feature is scaled to standard zero-mean unit-variance:
                </p>
                <div className="p-3 bg-neutral-900 rounded-lg font-mono text-emerald-400 text-center my-2">
                  z = (x - μ) / σ
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <h4 className="font-bold text-white text-sm mb-1.5">
                  2. Weighted Cosine Similarity
                </h4>
                <p className="text-neutral-400 mb-2">
                  Measures the angular alignment between two multi-dimensional audio vectors in ℝ⁹, irrespective of magnitude:
                </p>
                <div className="p-3 bg-neutral-900 rounded-lg font-mono text-amber-400 text-center my-2">
                  cos(θ) = (u · v) / (||u|| ||v||) = Σ(wⱼ · uⱼ · vⱼ) / [ √(Σ wⱼ uⱼ²) · √(Σ wⱼ vⱼ²) ]
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <h4 className="font-bold text-white text-sm mb-1.5">
                  3. k-NN Vector Matching & Euclidean Distance
                </h4>
                <p className="text-neutral-400 mb-2">
                  Finds the k closest neighbors in the weighted acoustic metric space:
                </p>
                <div className="p-3 bg-neutral-900 rounded-lg font-mono text-purple-400 text-center my-2">
                  d(u, v) = √[ Σ wⱼ · (uⱼ - vⱼ)² ]
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <h4 className="font-bold text-white text-sm mb-1.5">
                  4. Principal Component Analysis (PCA 2D Projection)
                </h4>
                <p className="text-neutral-400 mb-2">
                  Computes covariance matrix C = (1 / N-1) XᵀX and extracts top eigenvectors e₁, e₂ via power iteration to maximize explained variance along 2 orthogonal axes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span>Python 3.10+ · Streamlit 1.30+ · Spotipy 2.23+ · Scikit-Learn 1.4+</span>
          <button onClick={onClose} className="hover:text-white transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

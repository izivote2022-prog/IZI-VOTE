import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';
import { ApiClient } from '../../services/api.js';

interface AdminLoginProps {
  onLoginSuccess: (username: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('AdminElection2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await ApiClient.loginAdmin(username.trim(), password);
      onLoginSuccess(data.username);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDefaults = () => {
    setUsername('admin');
    setPassword('AdminElection2026!');
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/60 inline-block">
            IZI 2027-2028 MAKAI DING KI TEL NA
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-1">Election Administration</h2>
          <p className="text-xs text-slate-400">
            Sign in to govern rounds, monitor ballots, and certify official results.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/50 border border-rose-800 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Admin Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition"
              placeholder="e.g. admin"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition"
              placeholder="••••••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Access Management Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Default Administrator Credentials
            </span>
            <button
              onClick={fillDefaults}
              className="text-[11px] text-indigo-400 hover:underline font-semibold"
            >
              Autofill
            </button>
          </div>
          <div className="text-[11px] font-mono text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <div>Username: <span className="text-slate-200">admin</span></div>
            <div>Password: <span className="text-slate-200">AdminElection2026!</span></div>
          </div>
          <p className="text-[10px] text-slate-500">
            Passwords can be updated inside Admin Settings once logged in.
          </p>
        </div>
      </div>
    </div>
  );
};

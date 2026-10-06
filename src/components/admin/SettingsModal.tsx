import React, { useState } from 'react';
import {
  Settings,
  Lock,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Save,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { ElectionSettings } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';

interface SettingsModalProps {
  settings: ElectionSettings;
  onRefresh: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onRefresh }) => {
  // Settings Form State
  const [electionName, setElectionName] = useState(settings.electionName);
  const [organizationName, setOrganizationName] = useState(settings.organizationName);
  const [requireTokenMode, setRequireTokenMode] = useState(settings.requireTokenMode);
  const [allowPublicLiveResults, setAllowPublicLiveResults] = useState(
    settings.allowPublicLiveResults
  );
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Reset State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsMessage(null);

    try {
      await ApiClient.updateSettings({
        electionName: electionName.trim(),
        organizationName: organizationName.trim(),
        requireTokenMode,
        allowPublicLiveResults,
      });
      setSettingsMessage('Election settings saved successfully.');
      await onRefresh();
    } catch (err: any) {
      setSettingsMessage(err.message || 'Failed to update settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setPasswordLoading(true);
    try {
      await ApiClient.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Admin password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleHardReset = async () => {
    setResetLoading(true);
    try {
      await ApiClient.resetElection();
      setShowResetConfirm(false);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to reset election.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Election Configuration &amp; Backups
            </h2>
            <p className="text-xs text-slate-400">
              Manage system rules, administrator security credentials, and data persistence
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>General Election Parameters</span>
          </h3>

          {settingsMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300">
              {settingsMessage}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Election Title</label>
              <input
                type="text"
                value={electionName}
                onChange={(e) => setElectionName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Organization Name</label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">
                Voter Token Issuance Mode
              </label>
              <select
                value={requireTokenMode}
                onChange={(e) => setRequireTokenMode(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
              >
                <option value="TOKEN_OR_KIOSK">
                  Tokens or Public Kiosk Auto-Dispense (Recommended for Hybrid)
                </option>
                <option value="STRICT_TOKEN_ONLY">
                  Strict Token Only (Voters must enter admin-issued code)
                </option>
              </select>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPublicLiveResults}
                  onChange={(e) => setAllowPublicLiveResults(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-300">
                  Allow Public Live Results (Default: Hidden while voting is open)
                </span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={settingsLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                <Save className="w-4 h-4" />
                <span>{settingsLoading ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Change Admin Password */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Update Administrator Password</span>
          </h3>

          {passwordError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current admin password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <KeyRound className="w-4 h-4" />
                <span>{passwordLoading ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Database Backup & System Reset Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
          <Download className="w-4 h-4 text-teal-400" />
          <span>Data Backup &amp; System Reset</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-300 block">Export Full Database Backup</span>
            <p className="text-[11px] text-slate-400">
              Download the entire election state, all ballots, tokens, and chained audit logs as a pristine JSON file.
            </p>
            <a
              href="/api/admin/backup"
              download="election_vault_backup.json"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Backup</span>
            </a>
          </div>

          <div className="p-4 bg-rose-950/20 rounded-2xl border border-rose-900/50 space-y-3">
            <span className="text-xs font-bold text-rose-300 block">Reset to Initial Seed Data</span>
            <p className="text-[11px] text-slate-400">
              Resets the system back to the initial draft state with the pristine 10 Group A and 16 Group B seed candidates.
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hard Reset Election</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Confirm System Reset</h3>
                <p className="text-xs text-rose-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to reset all ballots, tokens, and progress? The candidate list will be restored to the official Group A (10 candidates) and Group B (16 candidates) initial seed data.
            </p>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHardReset}
                disabled={resetLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition shadow-lg shadow-rose-600/30"
              >
                {resetLoading ? 'Resetting...' : 'Yes, Reset Entire Election'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

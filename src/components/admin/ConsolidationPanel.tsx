import React, { useState } from 'react';
import { Layers, CheckCircle2, ArrowRight, AlertTriangle, Users, ShieldCheck } from 'lucide-react';
import { Candidate, ElectionDataStore, ElectionState } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';

interface ConsolidationPanelProps {
  state: ElectionDataStore & { activeRound: any; consolidationSummary: any };
  onRefresh: () => Promise<void>;
  onNavigateTab: (tab: string) => void;
}

export const ConsolidationPanel: React.FC<ConsolidationPanelProps> = ({
  state,
  onRefresh,
  onNavigateTab,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Group A remaining candidates (status === 'ACTIVE')
  const remainingGroupA = state.candidates.filter(
    (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
  );

  // Group B active candidates
  const activeGroupB = state.candidates.filter(
    (c) => c.group === 'GROUP_B' && c.status === 'ACTIVE'
  );

  // Elected winners from earlier rounds
  const round1Winner = state.candidates.find(
    (c) => c.electedPosition === 'IZI Makai Pi' || c.electedRound === 'ROUND_1'
  );
  const round2Winner = state.candidates.find(
    (c) => c.electedPosition === 'Genvai Tanu Pi' || c.electedRound === 'ROUND_2'
  );

  const totalConsolidatedCount = remainingGroupA.length + activeGroupB.length;
  const isConsolidationConfirmed =
    ['FINAL_ROUND_OPEN', 'FINAL_ROUND_CLOSED', 'COMPLETED'].includes(state.currentState) ||
    state.rounds.FINAL_ROUND.eligibleCandidateIds.length === 24;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.confirmConsolidation();
      setSuccessMessage(res.message);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm consolidation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Candidate Pool Consolidation
            </h2>
            <p className="text-xs text-slate-400">
              Combine Remaining Group A Candidates + Full Group B into the Final 24-Candidate Pool
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 font-medium">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-2xl flex items-center gap-3 text-xs text-emerald-300 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Official Required Confirmation Summary Screen */}
      <div className="bg-gradient-to-br from-slate-900 to-purple-950/30 border-2 border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
            Official Consolidation Audit Summary
          </span>
          <h3 className="text-xl font-black text-white mt-1">
            Required Pre-Final Round Candidate Verification
          </h3>
        </div>

        {/* 3 Prominent Stat Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 text-center">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Group A Remaining
            </span>
            <div className="text-4xl font-black text-white my-2">{remainingGroupA.length}</div>
            <span className="text-[11px] text-slate-500">
              (Initial 10 minus 2 elected winners)
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 text-center">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Group B
            </span>
            <div className="text-4xl font-black text-white my-2">{activeGroupB.length}</div>
            <span className="text-[11px] text-slate-500">(All 16 active Group B candidates)</span>
          </div>

          <div className="bg-purple-950/40 border border-purple-800/80 rounded-2xl p-5 text-center shadow-lg">
            <span className="text-xs font-bold uppercase text-purple-300 tracking-wider">
              Final Candidate Pool
            </span>
            <div className="text-4xl font-black text-purple-300 my-2">
              {totalConsolidatedCount}
            </div>
            <span className="text-[11px] text-purple-400 font-semibold">
              Exactly 24 Candidates Required
            </span>
          </div>
        </div>

        {/* Excluded Elected Winners Check */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-2 text-xs">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            Elected Executive Officers (Excluded from Final Pool)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">
                  Round 1 Elected (IZI Makai Pi)
                </span>
                <p className="font-extrabold text-white text-sm">
                  {round1Winner ? round1Winner.name : 'Pa. Pau Lam Lian (Pending)'}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">
                  Round 2 Elected (Genvai Tanu Pi)
                </span>
                <p className="font-extrabold text-white text-sm">
                  {round2Winner ? round2Winner.name : 'Pa. Gin Neng Tuang (Pending)'}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Action Confirmation Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              Confirmation will freeze the candidate roster and write an immutable audit record.
            </span>
          </div>

          {isConsolidationConfirmed ? (
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Consolidation Locked &amp; Certified (24 Pool)</span>
              </span>
              <button
                onClick={() => onNavigateTab('overview')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
              >
                Go to Overview
              </button>
            </div>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={loading || totalConsolidatedCount !== 24}
              className="px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-purple-600/30 flex items-center gap-2 transition"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Confirm Consolidation (24 Candidates)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Two Columns: Remaining Group A (8) & Group B (16) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Remaining Group A (8) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
              Group A Remaining Pool ({remainingGroupA.length})
            </h4>
            <span className="text-[10px] uppercase font-bold text-slate-400">Target: 8</span>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {remainingGroupA.map((c, i) => (
              <div
                key={c.id}
                className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-500 font-bold text-[11px]">#{i + 1}</span>
                  <span className="font-bold text-white">{c.name}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Group B (16) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
              Group B Pool ({activeGroupB.length})
            </h4>
            <span className="text-[10px] uppercase font-bold text-slate-400">Target: 16</span>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {activeGroupB.map((c, i) => (
              <div
                key={c.id}
                className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-500 font-bold text-[11px]">#{i + 1}</span>
                  <span className="font-bold text-white">{c.name}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

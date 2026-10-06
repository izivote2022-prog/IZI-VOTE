import React, { useState } from 'react';
import {
  Play,
  Square,
  Award,
  Layers,
  CheckCircle,
  AlertTriangle,
  Users,
  Vote as VoteIcon,
  KeyRound,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  Check,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { ElectionDataStore, ElectionState, RoundId, OFFICIAL_APP_NAME } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';

interface AdminOverviewProps {
  state: ElectionDataStore & { activeRound: any; consolidationSummary: any };
  onTransitionState: (newState: ElectionState, metadata?: Record<string, any>) => Promise<void>;
  onNavigateTab: (tab: string) => void;
  onOpenTieModal: () => void;
  onRefresh?: () => Promise<void>;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  state,
  onTransitionState,
  onNavigateTab,
  onOpenTieModal,
  onRefresh,
}) => {
  const [confirmModal, setConfirmModal] = useState<{
    targetState: ElectionState;
    title: string;
    description: string;
    warning?: string;
  } | null>(null);

  const [loadingAction, setLoadingAction] = useState(false);

  // Reset Round Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSelectedRound, setResetSelectedRound] = useState<RoundId>('ROUND_1');
  const [resetReason, setResetReason] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const currentState = state.currentState;
  const activeRound = state.activeRound;

  const groupACandidates = state.candidates.filter((c) => c.group === 'GROUP_A');
  const groupBCandidates = state.candidates.filter((c) => c.group === 'GROUP_B');
  const remainingGroupA = groupACandidates.filter((c) => c.status === 'ACTIVE').length;
  const activeGroupB = groupBCandidates.filter((c) => c.status === 'ACTIVE').length;
  const finalPoolCount = state.rounds.FINAL_ROUND?.eligibleCandidateIds?.length || 0;

  const activeCandidates = state.candidates.filter((c) => c.status === 'ACTIVE').length;
  const electedCandidates = state.candidates.filter((c) => c.status === 'ELECTED').length;

  const ballotsCast = (state.ballots || state.votes || []).length;
  const totalCandidateSelections = ballotsCast * 2;
  const totalTokens = state.tokens.length;
  const usedTokens = state.tokens.filter((t) => t.isUsed || t.status === 'USED').length;
  const tokenRedemptionRate = totalTokens > 0 ? Math.round((usedTokens / totalTokens) * 100) : 0;

  const handleAction = async () => {
    if (!confirmModal) return;
    setLoadingAction(true);
    try {
      await onTransitionState(confirmModal.targetState);
      setConfirmModal(null);
    } finally {
      setLoadingAction(false);
    }
  };

  // Complete 12-Phase Lifecycle (Part 1 & 13)
  const PHASES: Array<{ id: ElectionState; label: string; desc: string }> = [
    { id: 'DRAFT', label: '1. Draft', desc: 'Candidate registry preparation' },
    { id: 'ROUND_1_OPEN', label: '2. Round 1 Open', desc: 'IZI Makai Pi (2 Selections)' },
    { id: 'ROUND_1_CLOSED', label: '3. Round 1 Closed', desc: 'Ballots frozen' },
    { id: 'ROUND_1_FINALIZED', label: '4. Round 1 Finalized', desc: 'Winner elected (9 remain)' },
    { id: 'ROUND_2_OPEN', label: '5. Round 2 Open', desc: 'Genvai Tanu Pi (2 Selections)' },
    { id: 'ROUND_2_CLOSED', label: '6. Round 2 Closed', desc: 'Ballots frozen' },
    { id: 'ROUND_2_FINALIZED', label: '7. Round 2 Finalized', desc: 'Winner elected (8 remain)' },
    { id: 'CONSOLIDATION_PENDING', label: '8. Consolidation', desc: '8 Group A + 16 Group B = 24' },
    { id: 'FINAL_ROUND_OPEN', label: '9. Round 3 Open', desc: 'Top 7 Officers (2 Selections)' },
    { id: 'FINAL_ROUND_CLOSED', label: '10. Round 3 Closed', desc: 'Ballots frozen' },
    { id: 'FINAL_ROUND_FINALIZED', label: '11. Round 3 Finalized', desc: 'Top 7 assigned' },
    { id: 'COMPLETED', label: '12. Completed', desc: 'Official certification' },
  ];

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === currentState);
  const hasUnresolvedTie = activeRound?.hasTie || activeRound?.tieStatus === 'TIE_REQUIRES_ADMIN_ACTION';

  // Final Round tokens & readiness
  const finalTokens = state.tokens.filter((t) => t.roundId === 'FINAL_ROUND' && t.status !== 'REVOKED');
  const finalTokensDistributed = finalTokens.some((t) => t.status === 'DISTRIBUTED' || t.status === 'USED');
  const finalRoundReady =
    state.rounds.ROUND_1.isFinalized &&
    state.rounds.ROUND_2.isFinalized &&
    remainingGroupA === 8 &&
    activeGroupB === 16 &&
    finalPoolCount === 24 &&
    finalTokens.length > 0 &&
    finalTokensDistributed;

  // Selected round details for Reset Modal
  const roundToReset = state.rounds[resetSelectedRound];
  const roundBallots = (state.ballots || state.votes || []).filter((b) => b.roundId === resetSelectedRound).length;
  const roundCandidateSelections = roundToReset?.totalSelections !== undefined ? roundToReset.totalSelections : roundBallots * 2;
  const roundTokens = state.tokens.filter((t) => t.roundId === resetSelectedRound);
  const roundTokensGenerated = roundTokens.length;
  const roundTokensDistributed = roundTokens.filter((t) => t.status === 'DISTRIBUTED' || t.status === 'USED' || Boolean(t.distributedAt)).length;
  const roundTokensUnused = roundTokens.filter((t) => !t.isUsed && t.status !== 'REVOKED').length;
  const roundTokensUsed = roundTokens.filter((t) => t.isUsed || t.status === 'USED').length;
  const roundTokensRevoked = roundTokens.filter((t) => t.status === 'REVOKED').length;
  const roundCandidateCount = roundToReset?.eligibleCandidateIds?.length || 0;
  const isFinalizedLive = state.mode === 'LIVE' && (roundToReset?.isFinalized || state.currentState === 'COMPLETED');

  const handleExecuteReset = async () => {
    if (isFinalizedLive) {
      setResetError(
        '🛡️ Cannot reset this round: This round has been finalized or certified in a LIVE election. Finalized live election results cannot be destructively reset.'
      );
      return;
    }
    if (!resetReason.trim() || resetReason.trim().length < 5) {
      setResetError('Please enter an administrative reason (at least 5 characters) for resetting this round.');
      return;
    }
    if (resetConfirmation.trim() !== 'I UNDERSTAND THIS WILL RESET THE ROUND') {
      setResetError('Confirmation text must match exactly: "I UNDERSTAND THIS WILL RESET THE ROUND"');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    try {
      const res = await ApiClient.resetRound({
        roundId: resetSelectedRound,
        reason: resetReason.trim(),
        confirmation: resetConfirmation.trim(),
      });
      const successMsg = res?.message || `${roundToReset?.title || resetSelectedRound} was successfully reset.`;
      setResetSuccess(successMsg);

      // Immediately refresh live server state
      if (onRefresh) {
        await onRefresh();
      }

      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess(null);
        setResetReason('');
        setResetConfirmation('');
      }, 1200);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset round.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Official Voting Rule Card */}
      <div className="bg-indigo-950/40 border border-indigo-700/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
            <VoteIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              Enforced Voting Rule
            </span>
            <p className="text-sm font-black text-white">Each voter selects exactly 2 candidates.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-300 font-mono">
          <span className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            Ballots Cast: <strong className="text-white">{ballotsCast}</strong>
          </span>
          <span className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            Candidate Selections: <strong className="text-emerald-400">{totalCandidateSelections}</strong>
          </span>
          <span className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 hidden md:inline-block">
            Expected Max: <strong className="text-indigo-400">{ballotsCast * 2}</strong>
          </span>

          {/* Secure Reset Round Button (Part 7) */}
          <button
            onClick={() => {
              const defaultRound: RoundId =
                activeRound?.id ||
                (currentState.startsWith('FINAL') || currentState === 'CONSOLIDATION_PENDING' || currentState === 'COMPLETED'
                  ? 'FINAL_ROUND'
                  : currentState.startsWith('ROUND_2')
                  ? 'ROUND_2'
                  : 'ROUND_1');
              setResetSelectedRound(defaultRound);
              setResetError(null);
              setResetSuccess(null);
              setShowResetModal(true);
            }}
            className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-800/80 rounded-xl flex items-center gap-1.5 font-bold transition shadow-sm"
            title="Reset a specific election round"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Round</span>
          </button>
        </div>
      </div>

      {/* Tie Alert Banner */}
      {hasUnresolvedTie && (
        <div className="bg-amber-950/60 border-2 border-amber-600 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500 text-slate-950">
                  TIE_REQUIRES_ADMIN_ACTION
                </span>
                <h3 className="font-extrabold text-white text-base">
                  Tie Detected in {activeRound.title}!
                </h3>
              </div>
              <p className="text-xs text-amber-200 mt-1">
                Two or more candidates have equal top selections or boundary ties. Automatic advancement is frozen until the committee resolves the tie.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenTieModal}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition shrink-0"
          >
            Launch Tie Resolution Workflow
          </button>
        </div>
      )}

      {/* Main Status & Action Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-800">
              Current Election State
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-2 tracking-tight">
              {currentState.replace(/_/g, ' ')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {activeRound
                ? `${activeRound.title} • ${activeRound.description}`
                : 'System governance and candidate preparation stage.'}
            </p>
          </div>

          {/* Quick Action Trigger Button */}
          <div className="flex flex-wrap items-center gap-3">
            {currentState === 'DRAFT' && (
              <button
                onClick={() =>
                  setConfirmModal({
                    targetState: 'ROUND_1_OPEN',
                    title: 'Open Round 1: IZI Makai Pi',
                    description: 'This will freeze candidate modifications for Group A and open voting for 10 candidates. Each ballot requires exactly 2 candidate selections.',
                  })
                }
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Open Round 1 Voting</span>
              </button>
            )}

            {currentState === 'ROUND_1_OPEN' && (
              <button
                onClick={() =>
                  setConfirmModal({
                    targetState: 'ROUND_1_CLOSED',
                    title: 'Close Round 1 Voting',
                    description: 'This will immediately reject all new votes for Round 1 and freeze candidate selection tallies for counting.',
                    warning: 'Voters will no longer be able to submit ballots for IZI Makai Pi.',
                  })
                }
                className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Close Round 1 Voting</span>
              </button>
            )}

            {currentState === 'ROUND_1_CLOSED' && (
              <button
                disabled={hasUnresolvedTie}
                onClick={() =>
                  setConfirmModal({
                    targetState: 'ROUND_1_FINALIZED',
                    title: 'Finalize Round 1 & Elect IZI Makai Pi',
                    description:
                      'This certifies the Round 1 winner as IZI Makai Pi, removes the candidate from Group A (leaving 9 candidates), and unlocks Round 2 preparation.',
                  })
                }
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
              >
                <Award className="w-4 h-4" />
                <span>Finalize Round 1</span>
              </button>
            )}

            {currentState === 'ROUND_1_FINALIZED' && (
              <button
                onClick={() =>
                  setConfirmModal({
                    targetState: 'ROUND_2_OPEN',
                    title: 'Open Round 2: Genvai Tanu Pi',
                    description: 'This opens voting for Round 2 among the 9 remaining Group A candidates (2 selections per ballot).',
                  })
                }
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Open Round 2 Voting</span>
              </button>
            )}

            {currentState === 'ROUND_2_OPEN' && (
              <button
                onClick={() =>
                  setConfirmModal({
                    targetState: 'ROUND_2_CLOSED',
                    title: 'Close Round 2 Voting',
                    description: 'This will freeze ballots for Round 2 (Genvai Tanu Pi) and prepare counts.',
                  })
                }
                className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Close Round 2 Voting</span>
              </button>
            )}

            {currentState === 'ROUND_2_CLOSED' && (
              <button
                disabled={hasUnresolvedTie}
                onClick={() =>
                  setConfirmModal({
                    targetState: 'ROUND_2_FINALIZED',
                    title: 'Finalize Round 2 & Elect Genvai Tanu Pi',
                    description:
                      'This certifies the Round 2 winner as Genvai Tanu Pi, removes the candidate from Group A (leaving 8 candidates), and prompts for Consolidation.',
                  })
                }
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
              >
                <Award className="w-4 h-4" />
                <span>Finalize Round 2</span>
              </button>
            )}

            {currentState === 'ROUND_2_FINALIZED' && (
              <button
                onClick={() =>
                  setConfirmModal({
                    targetState: 'CONSOLIDATION_PENDING',
                    title: 'Proceed to Candidate Consolidation',
                    description: 'Prepare to consolidate 8 remaining Group A candidates + 16 Group B candidates into the final 24-candidate pool.',
                  })
                }
                className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 transition"
              >
                <Layers className="w-4 h-4" />
                <span>Prepare Consolidation (8 + 16 = 24)</span>
              </button>
            )}

            {currentState === 'CONSOLIDATION_PENDING' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigateTab('consolidation')}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 transition"
                >
                  <Layers className="w-4 h-4" />
                  <span>Verify Pool (8 + 16 = 24)</span>
                </button>
                <button
                  disabled={!finalRoundReady}
                  onClick={() =>
                    setConfirmModal({
                      targetState: 'FINAL_ROUND_OPEN',
                      title: 'Open Round 3 / Final Round Voting',
                      description: 'This opens voting for the consolidated 24 candidates to elect the Top 7 Executive Officers. Each ballot requires exactly 2 candidate selections.',
                    })
                  }
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Open Round 3 Voting</span>
                </button>
              </div>
            )}

            {currentState === 'FINAL_ROUND_OPEN' && (
              <button
                onClick={() =>
                  setConfirmModal({
                    targetState: 'FINAL_ROUND_CLOSED',
                    title: 'Close Round 3 Voting',
                    description: 'This will freeze all final ballots across the 24 candidates and calculate final rank assignments for the Top 7 positions.',
                  })
                }
                className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Close Round 3 Voting</span>
              </button>
            )}

            {currentState === 'FINAL_ROUND_CLOSED' && (
              <button
                disabled={hasUnresolvedTie}
                onClick={() =>
                  setConfirmModal({
                    targetState: 'FINAL_ROUND_FINALIZED',
                    title: 'Finalize Round 3 & Assign Top 7 Positions',
                    description: 'This computes final counts across the 24 candidates and assigns Ranks 1 to 7 to their respective executive leadership positions.',
                  })
                }
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
              >
                <Award className="w-4 h-4" />
                <span>Finalize Round 3 (Assign Top 7)</span>
              </button>
            )}

            {currentState === 'FINAL_ROUND_FINALIZED' && (
              <button
                disabled={hasUnresolvedTie}
                onClick={() =>
                  setConfirmModal({
                    targetState: 'COMPLETED',
                    title: 'Certify Final Election Results',
                    description: 'This permanently certifies all 9 elected leaders (IZI Makai Pi, Genvai Tanu Pi, and Top 7 Executive Officers) and concludes the election.',
                    warning: 'This action permanently locks election data and generates the official immutable certificate of election.',
                  })
                }
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Certify &amp; Complete Election</span>
              </button>
            )}

            {currentState === 'COMPLETED' && (
              <button
                onClick={() => onNavigateTab('results')}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
              >
                <Award className="w-4 h-4" />
                <span>View Official Certificate</span>
              </button>
            )}
          </div>
        </div>

        {/* Phase State Progress Line - All 12 Phases Displayed (Part 13) */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
            <span>Election Lifecycle Roadmap</span>
            <span>
              Phase {currentPhaseIndex + 1} of {PHASES.length}: <strong className="text-white">{PHASES[currentPhaseIndex]?.label}</strong>
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-full transition-all duration-500 rounded-full"
              style={{
                width: `${Math.round(((currentPhaseIndex + 1) / PHASES.length) * 100)}%`,
              }}
            ></div>
          </div>

          {/* Grid showing all 12 phases */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
            {PHASES.map((phase, idx) => (
              <div
                key={phase.id}
                className={`p-2.5 rounded-xl border text-xs transition ${
                  idx === currentPhaseIndex
                    ? 'bg-indigo-950/70 border-indigo-500 text-white font-bold ring-1 ring-indigo-500 shadow-md'
                    : idx < currentPhaseIndex
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-slate-950/20 border-slate-900 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                  {idx < currentPhaseIndex && <Check className="w-3 h-3 text-emerald-400" />}
                </div>
                <div className="truncate font-semibold">{phase.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{phase.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DEDICATED ROUND 3 — FINAL ROUND CARD (Part 3 & Part 14) */}
      <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white tracking-tight">ROUND 3 — FINAL ROUND</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    currentState === 'FINAL_ROUND_OPEN'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 animate-pulse'
                      : currentState === 'FINAL_ROUND_CLOSED'
                      ? 'bg-amber-950 text-amber-300 border border-amber-700'
                      : currentState === 'FINAL_ROUND_FINALIZED' || currentState === 'COMPLETED'
                      ? 'bg-blue-950 text-blue-300 border border-blue-700'
                      : finalRoundReady
                      ? 'bg-purple-950 text-purple-300 border border-purple-700'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {currentState === 'FINAL_ROUND_OPEN'
                    ? 'OPEN'
                    : currentState === 'FINAL_ROUND_CLOSED'
                    ? 'CLOSED'
                    : currentState === 'FINAL_ROUND_FINALIZED' || currentState === 'COMPLETED'
                    ? 'FINALIZED'
                    : finalRoundReady
                    ? 'READY TO OPEN'
                    : 'NOT READY'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidated 24-candidate pool • Elects Top 7 Executive Officers • Enforces 2 selections per ballot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('tokens')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>Round 3 Tokens ({finalTokens.length})</span>
            </button>
            <button
              onClick={() => onNavigateTab('results')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Top 7 Mapping</span>
            </button>
          </div>
        </div>

        {/* Round 3 Metrics Grid (Part 3) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Eligible Candidates
            </span>
            <div className="text-xl font-black text-white mt-1">24</div>
            <span className="text-[10px] text-slate-500">
              8 Group A + 16 Group B
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
              Ballots Cast
            </span>
            <div className="text-xl font-black text-white mt-1">
              {state.rounds.FINAL_ROUND?.ballotsCast || 0}
            </div>
            <span className="text-[10px] text-slate-500">Valid ballots</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">
              Candidate Selections
            </span>
            <div className="text-xl font-black text-indigo-400 mt-1">
              {state.rounds.FINAL_ROUND?.totalSelections || 0}
            </div>
            <span className="text-[10px] text-slate-500">
              Expected: {(state.rounds.FINAL_ROUND?.ballotsCast || 0) * 2} (× 2 rule)
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
              Tokens Redeemed
            </span>
            <div className="text-xl font-black text-white mt-1">
              {finalTokens.filter((t) => t.isUsed || t.status === 'USED').length}
              <span className="text-xs font-normal text-slate-500"> / {finalTokens.length}</span>
            </div>
            <span className="text-[10px] text-slate-500">
              {finalTokens.length > 0 ? (finalTokensDistributed ? 'Batch Distributed' : 'Distribution Pending') : 'No tokens generated'}
            </span>
          </div>
        </div>

        {/* Final Round Mathematical & Readiness Checklist (Part 2 & 15) */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Round 3 Readiness &amp; Consolidation Integrity
            </span>
            <span className="text-[11px] font-mono text-indigo-400">
              Formula: 8 (Remaining A) + 16 (Active B) = 24 Candidates
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                state.rounds.ROUND_1.isFinalized
                  ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              {state.rounds.ROUND_1.isFinalized ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <div>
                <span className="font-bold block">Round 1 Finalized</span>
                <span className="text-[10px] text-slate-400">IZI Makai Pi Elected &amp; Removed</span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                state.rounds.ROUND_2.isFinalized
                  ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              {state.rounds.ROUND_2.isFinalized ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <div>
                <span className="font-bold block">Round 2 Finalized</span>
                <span className="text-[10px] text-slate-400">Genvai Tanu Pi Elected &amp; Removed</span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                remainingGroupA === 8 && activeGroupB === 16 && finalPoolCount === 24
                  ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              {remainingGroupA === 8 && activeGroupB === 16 && finalPoolCount === 24 ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <div>
                <span className="font-bold block">24 Candidate Pool Frozen</span>
                <span className="text-[10px] text-slate-400">
                  A: {remainingGroupA}/8 • B: {activeGroupB}/16 • Total: {finalPoolCount}/24
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Round 3 Dedicated Action Controls Bar */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Round 3 Controls:
            </span>
            <span className="text-xs font-mono text-slate-500">
              State: <strong className="text-slate-300">{currentState}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentState === 'CONSOLIDATION_PENDING' && (
              <button
                disabled={!finalRoundReady}
                onClick={() =>
                  setConfirmModal({
                    targetState: 'FINAL_ROUND_OPEN',
                    title: 'Open Round 3 / Final Round Voting',
                    description: 'This opens voting for the consolidated 24 candidates to elect the Top 7 Executive Officers. Each ballot requires exactly 2 candidate selections.',
                  })
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>OPEN ROUND 3</span>
              </button>
            )}

            {currentState === 'FINAL_ROUND_OPEN' && (
              <button
                onClick={() =>
                  setConfirmModal({
                    targetState: 'FINAL_ROUND_CLOSED',
                    title: 'Close Round 3 Voting',
                    description: 'This will freeze all final ballots across the 24 candidates and calculate final rank assignments for the Top 7 positions.',
                  })
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>CLOSE ROUND 3</span>
              </button>
            )}

            {currentState === 'FINAL_ROUND_CLOSED' && (
              <button
                disabled={hasUnresolvedTie}
                onClick={() =>
                  setConfirmModal({
                    targetState: 'FINAL_ROUND_FINALIZED',
                    title: 'Finalize Round 3 & Assign Top 7 Positions',
                    description: 'This computes final counts across the 24 candidates and assigns Ranks 1 to 7 to their respective executive leadership positions.',
                  })
                }
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                <span>FINALIZE ROUND 3</span>
              </button>
            )}

            <button
              onClick={() => {
                setResetSelectedRound('FINAL_ROUND');
                setResetError(null);
                setResetSuccess(null);
                setShowResetModal(true);
              }}
              className="px-3.5 py-2 bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-800/80 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
              title="Reset Round 3 ballots, tokens, and results safely"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET ROUND 3</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Eligible Candidates</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{activeCandidates}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {electedCandidates} Elected to Office
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Ballots Cast</span>
            <VoteIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{ballotsCast}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across all election rounds
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Candidate Selections</span>
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{totalCandidateSelections}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Rule: {ballotsCast * 2} selections (2 per ballot)
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tokens Redeemed</span>
            <CheckCircle className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-2xl font-black text-teal-400 mt-2">
            {usedTokens} <span className="text-sm font-normal text-slate-400">/ {totalTokens}</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {tokenRedemptionRate}% Redemption Rate
          </span>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-6 max-h-[calc(100dvh-32px)] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">{confirmModal.title}</h3>
                <p className="text-xs text-slate-400">State Transition Confirmation</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">{confirmModal.description}</p>

            {confirmModal.warning && (
              <div className="p-3.5 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 font-medium">
                ⚠️ {confirmModal.warning}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={loadingAction}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAction}
                disabled={loadingAction}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {loadingAction ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>Confirm &amp; Proceed</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED ROUND RESET MODAL (Responsive Viewport, Sticky Header & Footer, Scrollable Content) */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-round-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !resetLoading) {
              setShowResetModal(false);
            }
          }}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Sticky Header */}
            <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 id="reset-round-modal-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                    RESET ELECTION ROUND
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Administrative round reset • Immutable audit logging enforced
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetLoading}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5 space-y-5 text-slate-100"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {resetSuccess && (
                <div className="p-3.5 bg-emerald-950/60 border border-emerald-700 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              {resetError && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-700 rounded-xl text-xs text-rose-300 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {/* Step 1: Select Round to Reset */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Select Round to Reset
                </label>
                <select
                  value={resetSelectedRound}
                  onChange={(e) => {
                    setResetSelectedRound(e.target.value as RoundId);
                    setResetError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-indigo-500"
                >
                  <option value="ROUND_1">Round 1 (IZI Makai Pi)</option>
                  <option value="ROUND_2">Round 2 (Genvai Tanu Pi)</option>
                  <option value="FINAL_ROUND">Round 3 / Final Round (Top 7 Executive Officers)</option>
                </select>
              </div>

              {/* Affected Impact Overview - All 11 Required Metrics Displayed Prior to Confirmation */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                  <span className="font-bold text-slate-300 uppercase tracking-wider block text-[10px]">
                    Pre-Confirmation Assessment for {roundToReset?.title}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-400">
                    Round: {roundToReset?.title || resetSelectedRound}
                  </span>
                </div>

                {/* 10 Structured Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-slate-300">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">1. Current Round</span>
                    <span className="font-bold text-white truncate block mt-0.5">{resetSelectedRound}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">2. Current Phase</span>
                    <span className="font-bold text-white truncate block mt-0.5">{currentState}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">3. Ballots Cast</span>
                    <span className="font-bold text-rose-400 block mt-0.5">{roundBallots}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">4. Candidate Selections</span>
                    <span className="font-bold text-indigo-400 block mt-0.5">{roundCandidateSelections}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">5. Tokens Generated</span>
                    <span className="font-bold text-white block mt-0.5">{roundTokensGenerated}</span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">6. Distributed Tokens</span>
                    <span className="font-bold text-indigo-400 block mt-0.5">{roundTokensDistributed}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">7. Unused Tokens</span>
                    <span className="font-bold text-emerald-400 block mt-0.5">{roundTokensUnused}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">8. Used Tokens</span>
                    <span className="font-bold text-amber-400 block mt-0.5">{roundTokensUsed}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">9. Revoked Tokens</span>
                    <span className="font-bold text-rose-400 block mt-0.5">{roundTokensRevoked}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">10. Candidates Affected</span>
                    <span className="font-bold text-indigo-400 block mt-0.5">{roundCandidateCount}</span>
                  </div>
                </div>

                {/* Item 11: Exact Consequences of the Reset */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    11. Exact Consequences of Reset:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                    <li>
                      <strong>Ballot Records:</strong> All {roundBallots} ballots cast in {roundToReset?.title} will be cleared from active tallies {state.mode === 'LIVE' ? '(and preserved in audit archive)' : ''}.
                    </li>
                    <li>
                      <strong>Token Security:</strong> All {roundTokensGenerated} tokens issued for {resetSelectedRound} will be permanently revoked. Old codes can never be reused.
                    </li>
                    <li>
                      <strong>Candidate Pool:</strong> Candidate roster remains intact ({roundCandidateCount} candidates). Any winner elected in this round will revert to active eligible status. Other rounds remain untouched.
                    </li>
                    <li>
                      <strong>State Transition:</strong> The election phase will return to{' '}
                      <span className="font-mono text-white">
                        {resetSelectedRound === 'ROUND_1'
                          ? 'DRAFT'
                          : resetSelectedRound === 'ROUND_2'
                          ? 'ROUND_1_FINALIZED'
                          : 'CONSOLIDATION_PENDING'}
                      </span>
                      .
                    </li>
                    <li>
                      <strong>Audit Trail:</strong> An immutable SHA-256 hash-chained audit log entry will be committed permanently recording administrator identity, timestamp, and affected totals.
                    </li>
                  </ul>
                </div>

                {isFinalizedLive && (
                  <div className="p-3 bg-rose-950/80 border border-rose-700 rounded-xl text-rose-200 text-xs font-bold mt-2">
                    🛡️ This round has been finalized or certified in a live election. Finalized live election results cannot be destructively reset.
                  </div>
                )}
              </div>

              {/* Administrative Reason Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Administrative Reason
                </label>
                <input
                  type="text"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="e.g. Committee decided to re-issue tokens due to test batch calibration"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-indigo-500"
                />
              </div>

              {/* Typed Confirmation Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Type <span className="text-rose-400 font-mono">I UNDERSTAND THIS WILL RESET THE ROUND</span> to confirm:
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetConfirmation('I UNDERSTAND THIS WILL RESET THE ROUND')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono cursor-pointer"
                  >
                    Autofill phrase
                  </button>
                </div>
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="I UNDERSTAND THIS WILL RESET THE ROUND"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-rose-500"
                />
              </div>
            </div>

            {/* Fixed Sticky Footer */}
            <div className="px-5 sm:px-7 py-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
              <div className="text-[11px] text-slate-400 hidden sm:block">
                {!isFinalizedLive ? (
                  <span>
                    Requires exact confirmation text:{' '}
                    <code className="text-rose-400 font-mono">I UNDERSTAND THIS WILL RESET THE ROUND</code>
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold">
                    Protected in LIVE certified mode — Reset disabled
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetLoading}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex-1 sm:flex-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={resetLoading}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20 flex-1 sm:flex-none cursor-pointer"
                >
                  {resetLoading ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>RESET ROUND</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

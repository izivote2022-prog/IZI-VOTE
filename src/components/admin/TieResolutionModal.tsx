import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Candidate, ElectionRound, RoundId } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';

interface TieResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRound: ElectionRound | null;
  candidates: Candidate[];
  onResolved: () => Promise<void>;
}

export const TieResolutionModal: React.FC<TieResolutionModalProps> = ({
  isOpen,
  onClose,
  activeRound,
  candidates,
  onResolved,
}) => {
  const [chosenCandidateId, setChosenCandidateId] = useState<string>('');
  const [method, setMethod] = useState<'ADMIN_DECISION' | 'COMMITTEE_DRAW' | 'CERTIFIED_RUNOFF'>('ADMIN_DECISION');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !activeRound) return null;

  const tiedCandidates = candidates.filter((c) =>
    activeRound.tiedCandidateIds?.includes(c.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenCandidateId) {
      setError('Please select the certified winner.');
      return;
    }
    if (!notes.trim()) {
      setError('Please enter official committee justification notes.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await ApiClient.resolveTie({
        roundId: activeRound.id,
        chosenWinnerId: chosenCandidateId,
        method,
        notes: notes.trim(),
      });
      await onResolved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve tie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tie-resolution-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-900 border-2 border-amber-600/70 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Sticky Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 id="tie-resolution-modal-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                Official Tie-Breaking Workflow
              </h3>
              <p className="text-xs text-amber-300">
                Resolution Required for {activeRound.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body: Candidates, Method, Witness Notes */}
        <form
          id="tie-resolution-form"
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5 space-y-5 text-slate-100"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Tied Candidates Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Certified Winner Among Tied Candidates
              </label>
              <span className="text-[11px] font-mono text-amber-400">
                {tiedCandidates.length} Candidates Tied
              </span>
            </div>
            <div className="space-y-2">
              {tiedCandidates.map((cand) => {
                const isSelected = chosenCandidateId === cand.id;
                return (
                  <div
                    key={cand.id}
                    onClick={() => setChosenCandidateId(cand.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500 text-slate-950'
                            : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-slate-950"></span>}
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-white block">{cand.name}</span>
                        {cand.bio && (
                          <span className="text-[11px] text-slate-400 line-clamp-1">{cand.bio}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-amber-400 font-bold shrink-0">
                      {cand.group === 'GROUP_A' ? 'Group A' : 'Group B'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Official Resolution Method */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Official Resolution Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-amber-500"
            >
              <option value="ADMIN_DECISION">
                Executive Election Committee Deliberation &amp; Vote
              </option>
              <option value="COMMITTEE_DRAW">
                Certified Public Lot / Manual Draw (with Official Witnesses)
              </option>
              <option value="CERTIFIED_RUNOFF">Certified Special Runoff Ballot Resolution</option>
            </select>
          </div>

          {/* Justification & Witness Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Justification &amp; Witness Notes (Audit Recorded)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record the official rationale, witness names, and committee decision details..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-amber-500 placeholder-slate-500"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Recorded into the immutable SHA-256 hash-chained audit log with timestamp and administrator user.
            </p>
          </div>
        </form>

        {/* Fixed Sticky Footer / Action Buttons */}
        <div className="px-5 sm:px-7 py-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0 flex items-center justify-between gap-3 z-10">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            {chosenCandidateId ? (
              <span className="text-amber-400 font-medium">Winner selected. Ready to certify.</span>
            ) : (
              <span>Please select the certified winner above.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex-1 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="tie-resolution-form"
              disabled={loading || !chosenCandidateId}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"></span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Tie Resolution</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

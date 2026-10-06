import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Vote as VoteIcon,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  Copy,
  Check,
  Users,
} from 'lucide-react';
import { ApiClient } from '../../services/api.js';

interface VoterViewProps {
  onOpenReceiptModal: () => void;
}

export const VoterView: React.FC<VoterViewProps> = ({ onOpenReceiptModal }) => {
  const [electionData, setElectionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [tokenVerificationResult, setTokenVerificationResult] = useState<{
    valid: boolean;
    message: string;
    roundName?: string;
  } | null>(null);

  // Selected candidates array - MUST BE EXACTLY 2
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // Confirmation dialog state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Success state
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    message: string;
    verificationCode: string;
    timestamp: string;
    roundTitle: string;
    candidateNames?: string[];
    selectionCount: number;
    electionName: string;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);

  const fetchState = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await ApiClient.getPublicElectionState();
      setElectionData(data);
    } catch (err) {
      console.error('Failed to load public election state:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchState();
    const timer = setInterval(() => fetchState(true), 8000);
    return () => clearInterval(timer);
  }, []);

  const handleCandidateToggle = (candidateId: string) => {
    setSubmissionError(null);

    if (selectedCandidateIds.includes(candidateId)) {
      // Deselect candidate
      setSelectedCandidateIds(selectedCandidateIds.filter((id) => id !== candidateId));
    } else {
      // Cannot select more than 2
      if (selectedCandidateIds.length >= 2) {
        setSubmissionError('You have already selected 2 candidates. Deselect one candidate first to select another.');
        return;
      }
      setSelectedCandidateIds([...selectedCandidateIds, candidateId]);
    }
  };

  const handleVerifyToken = async () => {
    if (!tokenInput.trim()) {
      setSubmissionError('Please enter a voting token to verify.');
      return;
    }

    setIsVerifyingToken(true);
    setSubmissionError(null);
    setTokenVerificationResult(null);

    try {
      const res = await ApiClient.verifyVoterToken({
        roundId: electionData?.currentRound?.id,
        tokenCode: tokenInput.trim(),
      });

      setTokenVerificationResult({
        valid: true,
        message: res.message || 'Token verified successfully. You may proceed to select 2 candidates.',
        roundName: res.roundName,
      });
    } catch (err: any) {
      setTokenVerificationResult({
        valid: false,
        message: err.message || 'Token verification failed. Please check your token.',
      });
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleConfirmVoteClick = () => {
    setSubmissionError(null);
    if (!tokenInput.trim()) {
      setSubmissionError('Please enter or claim an anonymous single-use voting token.');
      return;
    }
    if (selectedCandidateIds.length !== 2) {
      setSubmissionError('Please select exactly 2 candidates before continuing.');
      return;
    }
    setShowConfirmModal(true);
  };

  const executeVote = async () => {
    if (selectedCandidateIds.length !== 2 || !tokenInput.trim() || !electionData?.currentRound?.id) {
      setSubmissionError('Please select exactly 2 candidates before continuing.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const res = await ApiClient.submitVote({
        roundId: electionData.currentRound.id,
        candidateIds: selectedCandidateIds,
        tokenCode: tokenInput.trim(),
      });

      const selectedNames = selectedCandidateIds
        .map((id) => electionData.eligibleCandidates.find((c: any) => c.id === id)?.name)
        .filter(Boolean) as string[];

      setSubmittedReceipt({
        message: res.message || 'Your ballot has been recorded successfully.',
        verificationCode: res.verificationCode,
        timestamp: res.timestamp,
        roundTitle: res.roundTitle,
        candidateNames: selectedNames,
        selectionCount: 2,
        electionName: res.electionName || 'IZI 2027-2028 MAKAI DING KI TEL NA',
      });

      setShowConfirmModal(false);
      setSelectedCandidateIds([]);
      setTokenInput('');

      // Confetti burst
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
      });

      fetchState(true);
    } catch (err: any) {
      setSubmissionError(err.message || 'Failed to submit ballot.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReceiptCode = () => {
    if (!submittedReceipt?.verificationCode) return;
    navigator.clipboard.writeText(submittedReceipt.verificationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-medium">Connecting to Official Election Vault...</p>
      </div>
    );
  }

  // Not Open / Draft / Completed Screens
  if (!electionData?.isVotingOpen) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              {electionData?.currentState === 'DRAFT'
                ? 'Election Preparation'
                : electionData?.currentState === 'COMPLETED'
                ? 'Election Completed'
                : 'Voting Paused / Finalizing'}
            </span>
            <h2 className="text-2xl font-black text-white mt-4 tracking-tight">
              {electionData?.currentState === 'DRAFT'
                ? 'Voting Has Not Started Yet'
                : electionData?.currentState === 'COMPLETED'
                ? 'Election Concluded & Certified'
                : 'Voting Is Currently Closed'}
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              {electionData?.currentState === 'DRAFT'
                ? 'The election committee is finalizing the candidate list. Voting will open shortly.'
                : electionData?.currentState === 'COMPLETED'
                ? 'All rounds have concluded and the official results are now certified by the committee.'
                : 'The current election phase is closed for vote tallying or consolidation. Please wait for the administrator to open the next round.'}
            </p>
          </div>

          {electionData?.currentState === 'COMPLETED' && (
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-indigo-400 font-semibold mb-3">
                Certified Executive Officers Announcement
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Round 1 Elected</span>
                  <p className="font-bold text-sm text-emerald-400">IZI Makai Pi</p>
                  <p className="text-xs text-white">{electionData?.pastWinners?.round1Winner || 'Elected'}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Round 2 Elected</span>
                  <p className="font-bold text-sm text-emerald-400">Genvai Tanu Pi</p>
                  <p className="text-xs text-white">{electionData?.pastWinners?.round2Winner || 'Elected'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => fetchState(false)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-indigo-600/20"
            >
              Check for Updates
            </button>
            <button
              onClick={onOpenReceiptModal}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              Verify Past Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentRound = electionData.currentRound;
  const eligibleCandidates = electionData.eligibleCandidates || [];
  const selectionsCount = selectedCandidateIds.length;
  const isTwoSelected = selectionsCount === 2;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner with Election & Round Details */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Voting Active
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {currentRound?.id === 'ROUND_1'
                  ? 'Round 1 of 3'
                  : currentRound?.id === 'ROUND_2'
                  ? 'Round 2 of 3'
                  : 'Round 3 of 3 (Final Round)'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white mt-3 tracking-tight">
              {currentRound?.title}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              {currentRound?.description}
            </p>
          </div>

          <div className="shrink-0 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Official Voting Rule
            </span>
            <span className="text-sm font-extrabold text-indigo-400 block mt-0.5">
              Select Exactly 2 Candidates
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold block mt-1">
              1 Token = 1 Ballot (2 Selections)
            </span>
          </div>
        </div>

        {/* Anonymous Voting Guarantee */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-200">100% Anonymous &amp; Auditable:</strong> Your vote is decoupled from your identity using a single-use cryptographic token. No names, email addresses, or personal accounts are ever collected or stored.
          </p>
        </div>
      </div>

      {/* Success Notification Card (Receipt) */}
      {submittedReceipt && (
        <div className="bg-emerald-950/40 border-2 border-emerald-600/70 rounded-3xl p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Your ballot has been recorded successfully.</h3>
              <p className="text-xs text-emerald-300">
                Official ballot with 2 candidate selections safely deposited into the election vault.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Official Ballot Verification Code:</span>
              <button
                onClick={copyReceiptCode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="text-lg font-mono font-bold tracking-widest text-emerald-400 bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/60 select-all">
              {submittedReceipt.verificationCode}
            </div>

            <div className="flex flex-wrap justify-between text-[11px] text-slate-400 pt-1">
              <span>Election: IZI 2027-2028 MAKAI DING KI TEL NA</span>
              <span>Round: {submittedReceipt.roundTitle}</span>
              <span>Selections: 2</span>
              <span>Timestamp: {new Date(submittedReceipt.timestamp).toLocaleTimeString('en-US')}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Save your verification code. You can verify your ballot anytime via the{' '}
            <button
              onClick={onOpenReceiptModal}
              className="text-indigo-400 underline font-medium hover:text-indigo-300"
            >
              Verify Receipt
            </button>{' '}
            tool.
          </p>
        </div>
      )}

      {/* Token Input Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Step 1: Anonymous Voting Token</h3>
              <p className="text-xs text-slate-400">One official administrator-issued token casts one ballot (2 selections)</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            Admin Issued Pre-Voting
          </span>
        </div>

        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value.toUpperCase());
                setSubmissionError(null);
                setTokenVerificationResult(null);
              }}
              placeholder="Enter Pre-Issued Token (e.g. VT-8F3K-X91M-Q72P)"
              className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl px-4 py-3 text-base text-white placeholder-slate-500 font-mono tracking-wider transition uppercase"
            />
            <button
              type="button"
              onClick={handleVerifyToken}
              disabled={isVerifyingToken || !tokenInput.trim()}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition shrink-0 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              {isVerifyingToken ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Token</span>
                </>
              )}
            </button>
          </div>

          {tokenVerificationResult && (
            <div
              className={`mt-3 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
                tokenVerificationResult.valid
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-700 text-rose-300'
              }`}
            >
              {tokenVerificationResult.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div className="flex-1 font-medium">
                {tokenVerificationResult.message}
                {tokenVerificationResult.roundName && (
                  <span className="block text-[11px] opacity-80 mt-0.5">
                    Valid for: {tokenVerificationResult.roundName}
                  </span>
                )}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400 mt-2">
            Voting tokens are distributed in advance exclusively by election administrators. Each single-use token casts exactly one ballot with 2 candidate selections and is permanently invalidated upon submission.
          </p>
        </div>
      </div>

      {/* Candidate Selection Section */}
      <div className="space-y-4">
        {/* Selection Counter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-black text-white tracking-tight">
                Step 2: Select exactly 2 candidates.
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click candidate cards to select or deselect. Exactly 2 selections are required to submit.
            </p>
          </div>

          {/* Dynamic Counter Indicator */}
          <div className="shrink-0 flex items-center gap-2">
            <div
              className={`px-4 py-2 rounded-2xl border font-black text-sm flex items-center gap-2 ${
                isTwoSelected
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-md shadow-emerald-900/30'
                  : selectionsCount === 1
                  ? 'bg-amber-950 text-amber-300 border-amber-600'
                  : 'bg-slate-950 text-slate-400 border-slate-700'
              }`}
            >
              <span>Selected:</span>
              <span className="font-mono text-base font-black">
                {selectionsCount} / 2
              </span>
              {isTwoSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>
          </div>
        </div>

        {submissionError && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl flex items-center gap-3 text-xs sm:text-sm text-rose-300 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-medium">{submissionError}</span>
          </div>
        )}

        {/* Candidate Cards Grid with 3 visual states: UNSELECTED, SELECTED, DISABLED */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {eligibleCandidates.map((candidate: any, index: number) => {
            const isSelected = selectedCandidateIds.includes(candidate.id);
            // Disabled when 2 candidates are already selected and this one is not selected
            const isDisabled = isTwoSelected && !isSelected;

            return (
              <div
                key={candidate.id}
                onClick={() => {
                  if (isDisabled) {
                    setSubmissionError('You have already selected 2 candidates. Deselect one first to choose this candidate.');
                    return;
                  }
                  handleCandidateToggle(candidate.id);
                }}
                className={`relative flex items-center p-4 rounded-2xl border-2 transition-all duration-150 select-none ${
                  isSelected
                    ? 'bg-indigo-950/70 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/40 cursor-pointer'
                    : isDisabled
                    ? 'bg-slate-950/40 border-slate-800/50 opacity-40 cursor-not-allowed'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 cursor-pointer'
                }`}
              >
                {/* Visual Selection Indicator */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center border-2 mr-3.5 shrink-0 transition ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : isDisabled
                      ? 'border-slate-800 bg-slate-950 text-slate-700'
                      : 'border-slate-600 bg-slate-950'
                  }`}
                >
                  {isSelected ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500">#{index + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`font-extrabold text-sm sm:text-base truncate ${isSelected ? 'text-white' : isDisabled ? 'text-slate-500' : 'text-slate-100'}`}>
                      {candidate.name}
                    </h4>

                    {/* State Badge: UNSELECTED / SELECTED / DISABLED */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : isDisabled
                          ? 'bg-slate-900 text-slate-600 border border-slate-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isSelected ? 'SELECTED' : isDisabled ? 'DISABLED' : 'UNSELECTED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-800/80 text-slate-400 border border-slate-700/60">
                      {candidate.group === 'GROUP_A' ? 'Group A' : 'Group B'}
                    </span>
                    {candidate.bio && (
                      <span className="text-[11px] text-slate-400 truncate">
                        {candidate.bio}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Big Action Submit Button (Disabled until exactly 2 candidates are selected) */}
      <div className="pt-4 sticky bottom-4 z-20">
        <button
          type="button"
          onClick={handleConfirmVoteClick}
          disabled={!isTwoSelected || !tokenInput.trim()}
          className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-base rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition transform active:scale-[0.99]"
        >
          <span>
            {isTwoSelected
              ? 'Confirm Vote (2 Candidates Selected)'
              : selectionsCount === 1
              ? 'Please Select 1 More Candidate (1 / 2 Selected)'
              : 'Please Select Exactly 2 Candidates (0 / 2 Selected)'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">Confirm Your Ballot</h3>
              <p className="text-xs text-amber-300 font-semibold">
                You are about to submit your ballot with 2 selected candidates. This action cannot be undone.
              </p>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Election:</span>
                <span className="font-bold text-white text-right">IZI 2027-2028 MAKAI DING KI TEL NA</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Election Round:</span>
                <span className="font-bold text-white">{currentRound?.title}</span>
              </div>
              <div className="py-1 border-b border-slate-800">
                <span className="text-slate-400 block mb-1">Selected Candidates (2):</span>
                <div className="space-y-1 pl-2 border-l-2 border-indigo-500">
                  {selectedCandidateIds.map((id, i) => (
                    <div key={id} className="font-extrabold text-indigo-400 text-sm">
                      {i + 1}. {eligibleCandidates.find((c: any) => c.id === id)?.name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Voting Token:</span>
                <span className="font-mono text-slate-300 font-semibold">{tokenInput}</span>
              </div>
            </div>

            {/* Exactly: [ CANCEL ] [ CONFIRM VOTE ] */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition uppercase tracking-wider"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={executeVote}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 uppercase tracking-wider"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <VoteIcon className="w-4 h-4" />
                    <span>CONFIRM VOTE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

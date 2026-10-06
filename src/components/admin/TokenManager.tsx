import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  KeyRound,
  Download,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Copy,
  Check,
  Printer,
  QrCode,
  Ban,
  RefreshCw,
  Send,
  AlertTriangle,
  X,
  ShieldCheck,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { RoundId, VotingToken, ElectionState, ElectionRound, OFFICIAL_APP_NAME } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';

interface TokenManagerProps {
  tokens: VotingToken[];
  currentState?: ElectionState;
  rounds?: Record<RoundId, ElectionRound>;
  tokenInventory?: any;
  onRefresh: () => Promise<void>;
}

export const TokenManager: React.FC<TokenManagerProps> = ({
  tokens,
  currentState = 'DRAFT',
  rounds,
  tokenInventory,
  onRefresh,
}) => {
  const [selectedRound, setSelectedRound] = useState<RoundId>('ROUND_1');
  const [tokenCount, setTokenCount] = useState<number>(50);
  const [batchLabel, setBatchLabel] = useState<string>('Official Election Batch');

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GENERATED' | 'DISTRIBUTED' | 'USED' | 'REVOKED'>('ALL');
  const [roundFilter, setRoundFilter] = useState<'ALL' | RoundId>('ALL');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Print & QR Codes Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFilterRound, setPrintFilterRound] = useState<RoundId>('ROUND_1');
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<string, string>>({});
  const [generatingQr, setGeneratingQr] = useState(false);

  // Revocation Modal State
  const [revokingToken, setRevokingToken] = useState<VotingToken | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Regeneration Modal State
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  // Helper: check if voting is currently open or token batch locked for a round
  const isRoundOpenOrLocked = (rId: RoundId): boolean => {
    const expectedOpen: Record<RoundId, ElectionState> = {
      ROUND_1: 'ROUND_1_OPEN',
      ROUND_2: 'ROUND_2_OPEN',
      FINAL_ROUND: 'FINAL_ROUND_OPEN',
    };
    if (currentState === expectedOpen[rId]) return true;
    if (rounds && rounds[rId]?.isOpened) return true;
    if (rounds && rounds[rId]?.isTokenBatchLocked) return true;
    return false;
  };

  // Helper: check if round has already concluded
  const isRoundClosedOrFinalized = (rId: RoundId): boolean => {
    if (currentState === 'COMPLETED') return true;
    if (rId === 'ROUND_1' && ['ROUND_1_CLOSED', 'ROUND_1_FINALIZED', 'ROUND_2_OPEN', 'ROUND_2_CLOSED', 'ROUND_2_FINALIZED', 'CONSOLIDATION_PENDING', 'FINAL_ROUND_OPEN', 'FINAL_ROUND_CLOSED'].includes(currentState)) return true;
    if (rId === 'ROUND_2' && ['ROUND_2_CLOSED', 'ROUND_2_FINALIZED', 'CONSOLIDATION_PENDING', 'FINAL_ROUND_OPEN', 'FINAL_ROUND_CLOSED'].includes(currentState)) return true;
    if (rId === 'FINAL_ROUND' && ['FINAL_ROUND_CLOSED'].includes(currentState)) return true;
    return false;
  };

  // Calculate Token Inventory Metrics (Overall & Filtered)
  const calculateInventory = (tokenList: VotingToken[]) => {
    const totalGenerated = tokenList.length;
    const distributed = tokenList.filter((t) => t.status === 'DISTRIBUTED' || t.status === 'USED' || Boolean(t.distributedAt)).length;
    const used = tokenList.filter((t) => t.isUsed || t.status === 'USED').length;
    const revoked = tokenList.filter((t) => t.status === 'REVOKED').length;
    const unused = tokenList.filter((t) => !t.isUsed && t.status !== 'REVOKED').length;
    return { totalGenerated, distributed, unused, used, revoked };
  };

  const inventoryAll = calculateInventory(tokens);

  // Generate Token Batch
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await ApiClient.generateTokens({
        roundId: selectedRound,
        count: Number(tokenCount) || 25,
        batchLabel: batchLabel.trim() || 'General Batch',
      });

      setSuccessMessage(`Successfully generated ${res.count} anonymous voting tokens for ${selectedRound}.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to generate token batch.');
    } finally {
      setLoading(false);
    }
  };

  // Regenerate Unused Token Batch (Replaces previous unused tokens before voting starts)
  const handleRegenerate = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await ApiClient.regenerateTokens({
        roundId: selectedRound,
        count: Number(tokenCount) || 25,
        batchLabel: batchLabel.trim() || 'Regenerated Batch',
      });

      setSuccessMessage(`Successfully regenerated fresh token batch of ${res.count} tokens for ${selectedRound}. Previous unused batch invalidated.`);
      setShowRegenerateModal(false);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate tokens.');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Distribution
  const handleConfirmDistribution = async (roundId: RoundId) => {
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await ApiClient.confirmDistribution(roundId);
      setSuccessMessage(`Distribution confirmed for ${roundId}: ${res.count} tokens marked as DISTRIBUTED. Token batch is now locked against regeneration.`);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm token distribution.');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Token
  const handleRevoke = async () => {
    if (!revokingToken) return;
    setActionLoading(true);
    setError(null);

    try {
      await ApiClient.revokeToken(revokingToken.id, revokeReason.trim() || 'Administrative revocation');
      setSuccessMessage(`Token ${revokingToken.tokenCode} has been permanently revoked.`);
      setRevokingToken(null);
      setRevokeReason('');
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke token.');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (tokenCode: string) => {
    navigator.clipboard.writeText(tokenCode);
    setCopiedToken(tokenCode);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // QR Code generator for printable tokens
  useEffect(() => {
    if (!showPrintModal) return;

    let isMounted = true;
    setGeneratingQr(true);

    const tokensToPrint = tokens.filter(
      (t) => t.roundId === printFilterRound && t.status !== 'REVOKED' && !t.isUsed
    );

    const generateAllQr = async () => {
      const urls: Record<string, string> = {};
      for (const t of tokensToPrint.slice(0, 150)) {
        try {
          // Generates QR containing tokenCode
          const url = await QRCode.toDataURL(t.tokenCode, {
            width: 140,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
          });
          urls[t.id] = url;
        } catch (err) {
          console.error('QR code generation error for token:', t.id, err);
        }
      }
      if (isMounted) {
        setQrCodeDataUrls(urls);
        setGeneratingQr(false);
      }
    };

    generateAllQr();

    return () => {
      isMounted = false;
    };
  }, [showPrintModal, printFilterRound, tokens]);

  // Filter tokens for table
  const filteredTokens = tokens.filter((t) => {
    if (roundFilter !== 'ALL' && t.roundId !== roundFilter) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchTerm) {
      const matchSearch =
        t.tokenCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.batchLabel && t.batchLabel.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;
    }
    return true;
  });

  const getRoundDisplayName = (rId: RoundId) => {
    if (rId === 'ROUND_1') return 'Round 1 (IZI Makai Pi)';
    if (rId === 'ROUND_2') return 'Round 2 (Genvai Tanu Pi)';
    return 'Final Round (Top 7 Executive Officers)';
  };

  return (
    <div className="space-y-6">
      {/* Workflow Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <KeyRound className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Token Management Console
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Anonymous single-use voting tokens • Cryptographically hashed • Pre-issued before voting
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tokens &amp; QR Slips</span>
            </button>

            <a
              href="/api/admin/tokens/export?format=csv"
              download="voting_tokens.csv"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition"
              title="Export all tokens to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>

            <a
              href="/api/admin/tokens/export?format=json"
              download="voting_tokens.json"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition"
              title="Export all tokens to JSON"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </a>
          </div>
        </div>

        {/* Official Protocol Workflow Breadcrumb */}
        <div className="pt-3 border-t border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
            Official Pre-Voting Protocol Workflow:
          </span>
          <div className="flex items-center flex-wrap gap-2 text-[11px] font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
              1. Draft &amp; Candidates
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
              2. Admin Generates Tokens
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
              3. Export / Print / Distribute
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
              4. Confirm Distribution
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
              5. Open Round &amp; Voters Cast Ballots
            </span>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 5 Token Inventory Metrics Pillars (Matches Exact Prompt Specification) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Token Inventory Status
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Total Recorded: {inventoryAll.totalGenerated}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Total Generated */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Total Generated
              </span>
              <div className="text-2xl font-black text-white mt-1">
                {inventoryAll.totalGenerated}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">All batches created</p>
            </div>

            {/* Distributed */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">
                Distributed
              </span>
              <div className="text-2xl font-black text-indigo-400 mt-1">
                {inventoryAll.distributed}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Issued to voters</p>
            </div>

            {/* Unused */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                Unused
              </span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {inventoryAll.unused}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Available ballots</p>
            </div>

            {/* Used */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                Used
              </span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {inventoryAll.used}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Ballots cast</p>
            </div>

            {/* Revoked */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block">
                Revoked
              </span>
              <div className="text-2xl font-black text-rose-400 mt-1">
                {inventoryAll.revoked}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Cancelled by admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Generation & Batch Actions Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Generate or Pre-Distribute Tokens</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tokens must be generated before opening the voting round. Each token is high entropy (e.g. VT-8F3K-X91M-Q72P) and valid for exactly 1 ballot (2 candidate selections).
          </p>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Target Round</label>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value as RoundId)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500"
            >
              <option value="ROUND_1">Round 1 (IZI Makai Pi)</option>
              <option value="ROUND_2">Round 2 (Genvai Tanu Pi)</option>
              <option value="FINAL_ROUND">Final Round (Top 7 Executive Officers)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={tokenCount}
              onChange={(e) => setTokenCount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Batch Label</label>
            <input
              type="text"
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              placeholder="e.g. General Assembly Batch 1"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || isRoundOpenOrLocked(selectedRound) || isRoundClosedOrFinalized(selectedRound)}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Generate Batch</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Round Governance & Distribution Control Bar */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-white block">
              Round Controls for {getRoundDisplayName(selectedRound)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isRoundOpenOrLocked(selectedRound)
                ? 'Voting is OPEN or tokens are locked. Token regeneration is disabled to ensure ballot integrity.'
                : 'Round is in preparation. You may regenerate unused tokens or confirm distribution before voting starts.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Confirm Distribution Button */}
            <button
              type="button"
              disabled={actionLoading || isRoundClosedOrFinalized(selectedRound)}
              onClick={() => handleConfirmDistribution(selectedRound)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Confirm Distribution</span>
            </button>

            {/* Regenerate Unused Batch Button */}
            <button
              type="button"
              disabled={actionLoading || isRoundOpenOrLocked(selectedRound) || isRoundClosedOrFinalized(selectedRound)}
              onClick={() => setShowRegenerateModal(true)}
              className="px-3.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 disabled:opacity-40 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate Unused Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tokens Registry & Search Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-black text-white tracking-tight">
              Issued Token Registry ({filteredTokens.length} of {tokens.length})
            </h4>
            <p className="text-xs text-slate-400">
              Only authenticated administrators may view, search, export, or revoke tokens.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Round Filter */}
            <select
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="ALL">All Rounds</option>
              <option value="ROUND_1">Round 1 (IZI Makai Pi)</option>
              <option value="ROUND_2">Round 2 (Genvai Tanu Pi)</option>
              <option value="FINAL_ROUND">Final Round (Top 7)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="GENERATED">Generated</option>
              <option value="DISTRIBUTED">Distributed</option>
              <option value="USED">Used (Voted)</option>
              <option value="REVOKED">Revoked</option>
            </select>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search token code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Tokens Table */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Token Code</th>
                <th className="py-2.5 px-3">Round</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Distributed</th>
                <th className="py-2.5 px-3">Redeemed At</th>
                <th className="py-2.5 px-3">Batch Label</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No tokens matching selected criteria. Generate tokens using the form above.
                  </td>
                </tr>
              ) : (
                filteredTokens.map((t) => {
                  const isRevoked = t.status === 'REVOKED';
                  const isUsed = t.isUsed || t.status === 'USED';
                  const isDistributed = t.status === 'DISTRIBUTED';

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-white select-all">
                        {t.tokenCode}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-300">
                        {t.roundId === 'ROUND_1'
                          ? 'Round 1'
                          : t.roundId === 'ROUND_2'
                          ? 'Round 2'
                          : 'Final Round'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isUsed
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : isRevoked
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isDistributed
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {t.distributedAt ? new Date(t.distributedAt).toLocaleTimeString('en-US') : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {t.usedAt ? new Date(t.usedAt).toLocaleString('en-US') : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[140px] truncate">
                        {t.batchLabel || 'Standard'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => copyToClipboard(t.tokenCode)}
                            className="p-1 text-slate-400 hover:text-white rounded transition"
                            title="Copy Token Code"
                          >
                            {copiedToken === t.tokenCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {!isUsed && !isRevoked && (
                            <button
                              onClick={() => setRevokingToken(t)}
                              className="px-2 py-0.5 text-[10px] font-semibold text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 rounded transition"
                              title="Revoke unused token"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revocation Modal */}
      {revokingToken && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <Ban className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Revoke Voting Token</h3>
              </div>
              <button
                onClick={() => setRevokingToken(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to revoke token{' '}
              <strong className="font-mono text-white select-all">{revokingToken.tokenCode}</strong>?
              This token will be permanently marked as REVOKED and rejected if submitted.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Reason for Revocation
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Lost physical slip, damaged printout, voter replacement"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokingToken(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRevoke}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition"
              >
                {actionLoading ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regeneration Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <RefreshCw className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Regenerate Token Batch</h3>
              </div>
              <button
                onClick={() => setShowRegenerateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-xl text-xs text-amber-300">
              Warning: This will replace ALL existing unused tokens for {getRoundDisplayName(selectedRound)} with a newly generated batch of {tokenCount} tokens.
            </div>

            <p className="text-xs text-slate-300">
              Only perform this if the candidate list was changed or previous printed tokens need to be discarded prior to opening voting.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRegenerateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRegenerate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition"
              >
                {actionLoading ? 'Regenerating...' : 'Confirm Regeneration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Tokens & QR Codes Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-y-auto">
          {/* Header Controls (Hidden when printing via CSS @media print) */}
          <div className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-6 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Print Voting Tokens &amp; QR Slips</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ready-to-cut voting slips for election committee distribution to voters.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={printFilterRound}
                onChange={(e) => setPrintFilterRound(e.target.value as RoundId)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="ROUND_1">Round 1 (IZI Makai Pi)</option>
                <option value="ROUND_2">Round 2 (Genvai Tanu Pi)</option>
                <option value="FINAL_ROUND">Final Round (Top 7)</option>
              </select>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-lg shadow-indigo-600/30"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slips</span>
              </button>

              <button
                onClick={() => setShowPrintModal(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>

          {/* Printable Sheet */}
          <div className="max-w-5xl mx-auto w-full">
            {generatingQr ? (
              <div className="text-center py-16 text-slate-400 space-y-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-medium">Generating Cryptographic QR Codes...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4">
                {tokens
                  .filter((t) => t.roundId === printFilterRound && t.status !== 'REVOKED' && !t.isUsed)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="bg-white text-slate-950 p-4 rounded-xl border-2 border-dashed border-slate-400 flex flex-col justify-between space-y-3 print:border-black print:p-4"
                    >
                      <div className="border-b border-slate-200 pb-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 block">
                          Official Anonymous Ballot Slip
                        </span>
                        <h4 className="text-xs font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                          {OFFICIAL_APP_NAME}
                        </h4>
                        <span className="text-[10px] font-bold text-indigo-700 block mt-0.5">
                          {getRoundDisplayName(t.roundId)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {qrCodeDataUrls[t.id] ? (
                          <img
                            src={qrCodeDataUrls[t.id]}
                            alt="Token QR"
                            className="w-20 h-20 shrink-0 border border-slate-300 rounded"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                            QR
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-slate-500 block">
                            Your Voting Token:
                          </span>
                          <span className="font-mono font-black text-sm tracking-wide text-slate-950 block select-all">
                            {t.tokenCode}
                          </span>
                          <span className="text-[9px] text-slate-600 block leading-tight">
                            Rule: Select exactly 2 candidates
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-2 text-[8px] text-slate-500 flex justify-between">
                        <span>Single-Use • 1 Token = 1 Ballot</span>
                        <span>Keep Confidential</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

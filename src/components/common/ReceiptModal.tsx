import React, { useState } from 'react';
import { Search, X, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { ApiClient } from '../../services/api.js';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setReceiptData(null);

    try {
      const data = await ApiClient.verifyReceipt(code.trim());
      setReceiptData(data);
    } catch (err: any) {
      setError(err.message || 'Ballot receipt code not found.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Ballot Receipt Verification</h3>
              <p className="text-xs text-slate-400">Cryptographic audit proof for cast ballots</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <form onSubmit={handleVerify} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Enter Ballot Receipt Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. VOTE-REC-A7F9-82BC"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 uppercase font-mono tracking-wider transition"
              />
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Verify</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {receiptData && (
            <div className="bg-slate-950/70 border border-emerald-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">Official Ballot Verified</span>
              </div>

              <div className="text-xs space-y-1.5 text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Election:</span>
                  <span className="font-bold text-white text-right">IZI 2027-2028 MAKAI DING KI TEL NA</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Election Round:</span>
                  <span className="font-semibold text-white">{receiptData.roundTitle}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Receipt Code:</span>
                  <span className="font-mono font-semibold text-emerald-400">{receiptData.verificationCode}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Number of Selections:</span>
                  <span className="font-bold text-white">2</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-200">
                    {new Date(receiptData.timestamp).toLocaleString('en-US')}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Audit Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    CRYPTOGRAPHICALLY SEALED
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60">
                {receiptData.receiptNote} (Individual candidate selections remain confidential to protect voter privacy).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

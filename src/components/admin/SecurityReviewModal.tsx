import React from 'react';
import {
  ShieldCheck,
  Server,
  Smartphone,
  Lock,
  AlertTriangle,
  Layers,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';

export const SecurityReviewModal: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Security Architecture &amp; Threat Model Review
            </h2>
            <p className="text-xs text-slate-400">
              Formal assessment of anonymous voting assumptions, guarantees, and boundaries
            </p>
          </div>
        </div>
      </div>

      {/* Architecture Breakdown: Server-Side vs Client-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Server-Side Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-indigo-400 border-b border-slate-800 pb-3">
            <Server className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-white">Server-Side Authority &amp; State Engine</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>State Machine Gatekeeping:</strong> Strict server-side transition checks reject votes outside of open phases and prevent unauthorized state skips (e.g. DRAFT &rarr; FINAL_ROUND).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Atomic Token Redemption Mutex:</strong> A server concurrency mutex guarantees that even simultaneous race conditions trying to use the same token only allow a single vote.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Decoupled Ballot Vault:</strong> Ballot records store candidate ID, timestamp, and a decoupled verification code. Voter PII or IP addresses are never attached to ballots.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Cryptographic Audit Hash-Chaining:</strong> Every state change and administrative action produces a SHA-256 hash linked to the previous entry hash for tamper-evidence.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>PBKDF2 Administrator Authentication:</strong> Passwords never reside in client code. Sessions use cryptographically random 256-bit bearer tokens verified server-side.
              </span>
            </li>
          </ul>
        </div>

        {/* Client-Side Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400 border-b border-slate-800 pb-3">
            <Smartphone className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-white">Client-Side User Experience &amp; UI</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Voter Accounts Required:</strong> Clean, zero-friction interface. No email, password, OAuth, or personal identifier required to cast an official ballot.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Mobile-First Accessible Design:</strong> Large touch targets, clear high-contrast candidate selection cards, and real-time validation warnings.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Mandatory Confirmation Gate:</strong> Confirmation modal prevents accidental taps with a clear message: <em>"You are about to submit your vote. This action cannot be undone."</em>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Verifiable Ballot Receipts:</strong> Generates unique <code>VOTE-REC-XXXX-XXXX</code> receipt codes that voters can retain and check on the public receipt verification tool.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Concealed Intermediate Tally:</strong> Intermediate rankings and live percentages are withheld from voters while voting is active to prevent strategic herd voting.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Threat Model & Vulnerability Analysis */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Threat Analysis
          </span>
          <h3 className="text-lg font-black text-white mt-1">
            Anonymous Voting Assumptions &amp; Known Boundaries
          </h3>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Assumption 1: One-Person-One-Vote Enforcement via Single-Use Tokens</span>
            </h4>
            <p className="text-slate-300">
              <strong>Analysis:</strong> Pure browser-only anonymity cannot mathematically guarantee one-person-one-vote without external anchoring. Devices can clear cookies, use private tabs, or alternate cellular IP addresses.
            </p>
            <p className="text-slate-400">
              <strong>Mitigation:</strong> The system solves this through <strong>single-use cryptographic voting tokens</strong>. In a formal election, the election committee distributes physical or sealed ballot codes to vetted members. The server guarantees that every token is redeemed exactly once and cannot be replayed.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Assumption 2: Protection Against Race Conditions &amp; Concurrent Token Usage</span>
            </h4>
            <p className="text-slate-300">
              <strong>Analysis:</strong> In a distributed environment, a voter could attempt to submit multiple requests with the same token in the same millisecond to race past a standard check.
            </p>
            <p className="text-slate-400">
              <strong>Mitigation:</strong> All vote submissions pass through an in-memory atomic promise mutex queue. Token validation and marking as spent occurs in an indivisible transaction prior to ballot insertion.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Assumption 3: Tamper-Evident Administrative Logs</span>
            </h4>
            <p className="text-slate-300">
              <strong>Analysis:</strong> Corrupted administrators could retroactively alter vote timestamps or candidate lists without detection.
            </p>
            <p className="text-slate-400">
              <strong>Mitigation:</strong> Audit records are chained using SHA-256 block hashes (analogous to git commits or blockchain headers). Any modification to past entries breaks the cryptographic hash continuity of subsequent entries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

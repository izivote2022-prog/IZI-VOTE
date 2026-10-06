import React, { useState } from 'react';
import { ShieldCheck, Search, Download, CheckCircle2, History, Hash } from 'lucide-react';
import { ElectionAuditLog } from '../../types/index.js';

interface AuditLogViewerProps {
  logs: ElectionAuditLog[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = [...logs].reverse().filter((l) => {
    const term = searchTerm.toLowerCase();
    return (
      l.action.toLowerCase().includes(term) ||
      l.adminUser.toLowerCase().includes(term) ||
      (l.affectedCandidateName && l.affectedCandidateName.toLowerCase().includes(term)) ||
      l.stateAfter.toLowerCase().includes(term) ||
      l.entryHash.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <History className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Immutable Election Audit Trail
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-950 text-teal-300 border border-teal-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>SHA-256 Chained</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Append-only cryptographic ledger of every administrative action and state change
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/admin/audit-logs/export"
            download="election_audit_trail.csv"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit CSV</span>
          </a>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="text-base font-black text-white tracking-tight">
            Audit Ledger ({filteredLogs.length} Records)
          </h4>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search action, administrator, or hash..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-teal-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Administrator</th>
                <th className="py-2.5 px-3">Action Description</th>
                <th className="py-2.5 px-3">State Transition</th>
                <th className="py-2.5 px-3">Target Candidate / Round</th>
                <th className="py-2.5 px-3 font-mono">Entry Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-US')}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                    {log.adminUser}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-200">{log.action}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-mono text-[10px] text-slate-400">
                      {log.stateBefore} &rarr;{' '}
                    </span>
                    <span className="font-mono text-[10px] text-indigo-400 font-bold">
                      {log.stateAfter}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    {log.affectedCandidateName || log.affectedRound || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-teal-400/90 whitespace-nowrap select-all">
                    {log.entryHash.substring(0, 16)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

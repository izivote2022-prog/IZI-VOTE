import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TestSuiteReport } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';

export const TestSuiteRunner: React.FC = () => {
  const [report, setReport] = useState<TestSuiteReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const data = await ApiClient.runTestSuite();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute test suite.');
    } finally {
      setIsRunning(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedTestId(expandedTestId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-800">
              System Quality Assurance
            </span>
            <span className="text-xs text-slate-400 font-mono">83 Automated Scenarios</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight">
            Election Lifecycle, Round 3 &amp; Security Test Suite
          </h2>
          <p className="text-xs text-slate-400">
            Comprehensive automated verification of the 3-round lifecycle, 2-candidate selection rule, 24-candidate consolidation, Top 7 position mapping, dedicated token batches, and secure round reset.
          </p>
        </div>

        <button
          onClick={runTests}
          disabled={isRunning}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition shrink-0"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Executing Tests...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Execute All 70 Tests</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Summary Scorecard if run */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Executed</span>
            <div className="text-2xl font-black text-white mt-1">{report.totalTests} Tests</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400">Tests Passed</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {report.passedCount} / {report.totalTests}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-center">
            <span className="text-[10px] uppercase font-bold text-rose-400">Tests Failed</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{report.failedCount}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Duration</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">
              {report.totalDurationMs} ms
            </div>
          </div>
        </div>
      )}

      {/* Test Results List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
        <h4 className="text-base font-black text-white tracking-tight">
          {report ? `Test Execution Results (${report.passedCount}/${report.totalTests} Passed)` : 'Test Specifications (21 Test Scenarios)'}
        </h4>

        <div className="space-y-2">
          {report ? (
            report.results.map((test) => (
              <div
                key={test.id}
                className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden transition"
              >
                <div
                  onClick={() => toggleExpand(test.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/40 select-none"
                >
                  <div className="flex items-center gap-3">
                    {test.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          #{test.id}
                        </span>
                        <h5 className="font-extrabold text-sm text-white">{test.name}</h5>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {test.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{test.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500">{test.durationMs}ms</span>
                    {expandedTestId === test.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {expandedTestId === test.id && test.details && test.details.length > 0 && (
                  <div className="px-4 pb-3.5 pt-1 border-t border-slate-800/60 bg-slate-900/30 text-xs font-mono text-slate-400 space-y-1">
                    {test.details.map((detail, idx) => (
                      <div key={idx} className="pl-4 border-l-2 border-indigo-500/40">
                        {detail}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-10 space-y-3">
              <ShieldCheck className="w-10 h-10 text-indigo-400 mx-auto" />
              <p className="text-sm text-slate-300 font-bold">
                Click "Execute All 21 Tests" to run the automated lifecycle &amp; 2-candidate verification suite.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Validates: 0 selections (Reject) &bull; 1 selection (Reject) &bull; 2 selections (Accept) &bull; 3 selections (Reject) &bull; Duplicate [A, A] (Reject) &bull; Point allocation (+1 per selection) &bull; Order invariance ([A, B] == [B, A]) &bull; 100 ballots = 200 selections &bull; Round 1 &amp; Round 2 &amp; Final Top 7 &bull; Tie Handling.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

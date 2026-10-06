import React, { useState } from 'react';
import {
  Award,
  Printer,
} from 'lucide-react';
import { ElectionDataStore, RoundId, FINAL_TOP_POSITIONS, OFFICIAL_APP_NAME } from '../../types/index.js';

interface ResultsViewProps {
  state: ElectionDataStore & { activeRound: any; consolidationSummary: any };
}

export const ResultsView: React.FC<ResultsViewProps> = ({ state }) => {
  const [selectedRoundTab, setSelectedRoundTab] = useState<RoundId>('FINAL_ROUND');

  const round1Result = state.results.ROUND_1;
  const round2Result = state.results.ROUND_2;
  const finalResult = state.results.FINAL_ROUND;

  const round1Winner = state.candidates.find(
    (c) => c.electedPosition === 'IZI Makai Pi' || c.electedRound === 'ROUND_1'
  );
  const round2Winner = state.candidates.find(
    (c) => c.electedPosition === 'Genvai Tanu Pi' || c.electedRound === 'ROUND_2'
  );

  const isFinalCertified = state.currentState === 'COMPLETED' || finalResult?.isCertified;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Official Certificate Banner */}
      {isFinalCertified && (
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950">
                  Official Election Certificate
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {OFFICIAL_APP_NAME}
                </h2>
                <p className="text-xs text-amber-200/80">
                  Certified by Election Administrator on{' '}
                  {new Date(state.certifiedAt || state.updatedAt).toLocaleString('en-US')}
                </p>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Certificate</span>
            </button>
          </div>

          {/* Top Executive Leadership Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Supreme Executive Leader
                </span>
                <h3 className="text-lg font-black text-white">IZI Makai Pi</h3>
                <p className="text-sm font-bold text-emerald-400 mt-1">
                  {round1Winner ? round1Winner.name : 'Pa. Pau Lam Lian'}
                </p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                  ELECTED R1
                </span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Principal Executive Officer
                </span>
                <h3 className="text-lg font-black text-white">Genvai Tanu Pi</h3>
                <p className="text-sm font-bold text-emerald-400 mt-1">
                  {round2Winner ? round2Winner.name : 'Pa. Gin Neng Tuang'}
                </p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                  ELECTED R2
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Round 1, Round 2, Final Round */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setSelectedRoundTab('FINAL_ROUND')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            selectedRoundTab === 'FINAL_ROUND'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Final Round: Top 7 Officers &amp; Full Pool</span>
        </button>

        <button
          onClick={() => setSelectedRoundTab('ROUND_1')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            selectedRoundTab === 'ROUND_1'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Round 1: IZI Makai Pi</span>
        </button>

        <button
          onClick={() => setSelectedRoundTab('ROUND_2')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            selectedRoundTab === 'ROUND_2'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Round 2: Genvai Tanu Pi</span>
        </button>
      </div>

      {/* Tab 1: Final Round Results */}
      {selectedRoundTab === 'FINAL_ROUND' && (
        <div className="space-y-6">
          {/* Round Header & Metrics */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Voting Rule</span>
              <p className="text-xs font-extrabold text-white">Each voter selects exactly 2 candidates.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                Eligible Candidates: <strong className="text-white">24</strong>
              </span>
              <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                Ballots Cast: <strong className="text-white">{finalResult ? finalResult.ballotsCast : state.rounds.FINAL_ROUND.ballotsCast || 0}</strong>
              </span>
              <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                Total Selections: <strong className="text-emerald-400">{finalResult ? finalResult.totalSelections : state.rounds.FINAL_ROUND.totalSelections || 0}</strong>
              </span>
              <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                Expected Max: <strong className="text-indigo-400">{(finalResult ? finalResult.ballotsCast : state.rounds.FINAL_ROUND.ballotsCast || 0) * 2}</strong>
              </span>
            </div>
          </div>

          {/* Top 7 Executive Officers Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  Certified Top 7 Executive Leadership Positions
                </h3>
                <p className="text-xs text-slate-400">
                  Assigned strictly in descending order of selections from the consolidated 24-candidate pool.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {FINAL_TOP_POSITIONS.map((pos) => {
                const candidateResult = finalResult?.candidateResults?.find(
                  (r) => r.rank === pos.rank
                );

                return (
                  <div
                    key={pos.rank}
                    className="bg-slate-900 border-2 border-indigo-500/30 rounded-2xl p-4 shadow-lg hover:border-indigo-500/60 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-800">
                        Rank #{pos.rank}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {candidateResult ? `${candidateResult.selectionCount} selections` : '—'}
                      </span>
                    </div>

                    <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                      {pos.title}
                    </div>

                    <h4 className="text-base font-black text-white mt-1 truncate">
                      {candidateResult ? candidateResult.candidateName : 'Awaiting Final Round'}
                    </h4>

                    {candidateResult && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{candidateResult.percentage}% of selections</span>
                        <span className="font-semibold text-slate-300">
                          {candidateResult.group === 'GROUP_A' ? 'Group A' : 'Group B'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full 24 Candidate Ranking Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="text-base font-black text-white tracking-tight">
              Complete Consolidated 24-Candidate Results Table
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Candidate Full Name</th>
                    <th className="py-3 px-4">Group</th>
                    <th className="py-3 px-4">Assigned Executive Office</th>
                    <th className="py-3 px-4 text-right">Selections</th>
                    <th className="py-3 px-4 text-right">Percentage</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {finalResult?.candidateResults ? (
                    finalResult.candidateResults.map((cand) => (
                      <tr
                        key={cand.candidateId}
                        className={`hover:bg-slate-800/40 transition ${
                          cand.rank <= 7 ? 'bg-indigo-950/20 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          #{cand.rank}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {cand.candidateName}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cand.group === 'GROUP_A'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : 'bg-purple-950 text-purple-300 border border-purple-800'
                            }`}
                          >
                            {cand.group === 'GROUP_A' ? 'Group A' : 'Group B'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {cand.electedPosition ? (
                            <span className="font-extrabold text-amber-400">
                              {cand.electedPosition}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {cand.selectionCount}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {cand.percentage}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              cand.rank <= 7
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {cand.rank <= 7 ? 'Elected' : 'Ranked'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Final Round voting has not yet closed or been calculated.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Round 1 Results */}
      {selectedRoundTab === 'ROUND_1' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Round 1: IZI Makai Pi</h3>
                <p className="text-xs text-slate-400">
                  Initial 10 Group A Candidates • 2 Selections per Ballot • Winner elected as IZI Makai Pi
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  Ballots Cast: <strong className="text-white">{round1Result ? round1Result.ballotsCast : state.rounds.ROUND_1.ballotsCast || 0}</strong>
                </span>
                <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  Total Selections: <strong className="text-emerald-400">{round1Result ? round1Result.totalSelections : state.rounds.ROUND_1.totalSelections || 0}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4 text-right">Selections</th>
                    <th className="py-3 px-4 text-right">Percentage</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {round1Result?.candidateResults ? (
                    round1Result.candidateResults.map((cand) => (
                      <tr
                        key={cand.candidateId}
                        className={`hover:bg-slate-800/40 transition ${
                          cand.rank === 1 ? 'bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-white">#{cand.rank}</td>
                        <td className="py-3 px-4 font-bold text-white">{cand.candidateName}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {cand.selectionCount}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {cand.percentage}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cand.rank === 1 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Elected IZI Makai Pi
                            </span>
                          ) : (
                            <span className="text-slate-500">Advances to Round 2</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Round 1 vote counts will appear when voting closes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Round 2 Results */}
      {selectedRoundTab === 'ROUND_2' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Round 2: Genvai Tanu Pi</h3>
                <p className="text-xs text-slate-400">
                  9 Remaining Group A Candidates • 2 Selections per Ballot • Winner elected as Genvai Tanu Pi
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  Ballots Cast: <strong className="text-white">{round2Result ? round2Result.ballotsCast : state.rounds.ROUND_2.ballotsCast || 0}</strong>
                </span>
                <span className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  Total Selections: <strong className="text-emerald-400">{round2Result ? round2Result.totalSelections : state.rounds.ROUND_2.totalSelections || 0}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4 text-right">Selections</th>
                    <th className="py-3 px-4 text-right">Percentage</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {round2Result?.candidateResults ? (
                    round2Result.candidateResults.map((cand) => (
                      <tr
                        key={cand.candidateId}
                        className={`hover:bg-slate-800/40 transition ${
                          cand.rank === 1 ? 'bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-white">#{cand.rank}</td>
                        <td className="py-3 px-4 font-bold text-white">{cand.candidateName}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {cand.selectionCount}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {cand.percentage}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cand.rank === 1 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Elected Genvai Tanu Pi
                            </span>
                          ) : (
                            <span className="text-slate-500">Advances to Consolidation (8 remain)</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Round 2 vote counts will appear when voting closes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

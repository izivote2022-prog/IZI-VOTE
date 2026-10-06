import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Award,
  ShieldAlert,
} from 'lucide-react';
import { Candidate, CandidateGroupType, CandidateStatus, ElectionState } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';

interface CandidateManagerProps {
  candidates: Candidate[];
  currentState: ElectionState;
  onRefresh: () => Promise<void>;
}

export const CandidateManager: React.FC<CandidateManagerProps> = ({
  candidates,
  currentState,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState<'ALL' | CandidateGroupType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CandidateStatus>('ALL');

  // Add / Edit Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);

  const [formName, setFormName] = useState('');
  const [formGroup, setFormGroup] = useState<CandidateGroupType>('GROUP_A');
  const [formBio, setFormBio] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Is candidate modification blocked by active open voting?
  const isVotingOpen = ['ROUND_1_OPEN', 'ROUND_2_OPEN', 'FINAL_ROUND_OPEN'].includes(currentState);
  const isElectionLocked = currentState === 'COMPLETED' || currentState === 'FINAL_ROUND_CLOSED';

  const openAddModal = () => {
    setFormName('');
    setFormGroup('GROUP_A');
    setFormBio('');
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (c: Candidate) => {
    setEditingCandidate(c);
    setFormName(c.name);
    setFormGroup(c.group);
    setFormBio(c.bio || '');
    setFormError(null);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Candidate full name is required.');
      return;
    }
    setFormLoading(true);
    setFormError(null);

    try {
      await ApiClient.addCandidate({
        name: formName.trim(),
        group: formGroup,
        bio: formBio.trim() || undefined,
      });
      setShowAddModal(false);
      await onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add candidate.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate || !formName.trim()) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await ApiClient.editCandidate(editingCandidate.id, {
        name: formName.trim(),
        group: formGroup,
        bio: formBio.trim() || undefined,
      });
      setEditingCandidate(null);
      await onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update candidate.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (candidate: Candidate) => {
    const nextStatus: CandidateStatus = candidate.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      await ApiClient.setCandidateStatus(candidate.id, nextStatus);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update candidate status.');
    }
  };

  const handleDelete = async (candidate: Candidate) => {
    if (!confirm(`Are you sure you want to permanently delete candidate "${candidate.name}"?`)) {
      return;
    }
    try {
      await ApiClient.removeCandidate(candidate.id);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove candidate.');
    }
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = groupFilter === 'ALL' || c.group === groupFilter;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesGroup && matchesStatus;
  });

  const groupACount = candidates.filter((c) => c.group === 'GROUP_A').length;
  const groupBCount = candidates.filter((c) => c.group === 'GROUP_B').length;

  return (
    <div className="space-y-6">
      {/* Notice if modification is blocked */}
      {(isVotingOpen || isElectionLocked) && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-300">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            Candidate roster modifications are strictly locked while an election round is actively open or finalized to safeguard election integrity.
          </span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Candidate Registry</h2>
          <p className="text-xs text-slate-400">
            Total Candidates: {candidates.length} (Group A: {groupACount}, Group B: {groupBCount})
          </p>
        </div>

        <button
          onClick={openAddModal}
          disabled={isVotingOpen || isElectionLocked}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Candidate</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search candidate name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 transition"
          >
            <option value="ALL">All Groups</option>
            <option value="GROUP_A">Group A Only</option>
            <option value="GROUP_B">Group B Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ELECTED">Elected to Office</option>
            <option value="DEACTIVATED">Deactivated</option>
            <option value="FINAL_RANKED">Final Ranked</option>
          </select>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Candidate Identifier</th>
                <th className="py-3.5 px-4">Candidate Full Name</th>
                <th className="py-3.5 px-4">Assigned Group</th>
                <th className="py-3.5 px-4">Current Status</th>
                <th className="py-3.5 px-4">Elected Position</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No candidates found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 font-medium">{c.id}</td>
                    <td className="py-3.5 px-4 font-extrabold text-white">{c.name}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase border ${
                          c.group === 'GROUP_A'
                            ? 'bg-blue-950 text-blue-300 border-blue-800'
                            : 'bg-purple-950 text-purple-300 border-purple-800'
                        }`}
                      >
                        {c.group === 'GROUP_A' ? 'Group A' : 'Group B'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          c.status === 'ELECTED'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : c.status === 'ACTIVE'
                            ? 'bg-slate-800 text-slate-200 border-slate-700'
                            : c.status === 'DEACTIVATED'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {c.electedPosition ? (
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                          <Award className="w-3.5 h-3.5" />
                          <span>{c.electedPosition}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(c)}
                          disabled={isVotingOpen || isElectionLocked}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-lg transition"
                          title="Edit Candidate"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(c)}
                          disabled={isVotingOpen || isElectionLocked || c.status === 'ELECTED'}
                          className={`p-1.5 rounded-lg disabled:opacity-30 transition ${
                            c.status === 'ACTIVE'
                              ? 'text-rose-400 hover:bg-rose-950/40'
                              : 'text-emerald-400 hover:bg-emerald-950/40'
                          }`}
                          title={c.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                        >
                          {c.status === 'ACTIVE' ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDelete(c)}
                          disabled={isVotingOpen || isElectionLocked || c.status === 'ELECTED'}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 disabled:opacity-30 rounded-lg transition"
                          title="Delete Candidate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editingCandidate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <h3 className="text-lg font-black text-white tracking-tight">
              {showAddModal ? 'Register New Candidate' : `Edit Candidate: ${editingCandidate?.name}`}
            </h3>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={showAddModal ? handleSaveAdd : handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Legal / Candidate Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Pa. Pau Lam Lian"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:border-indigo-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Candidate Group
                </label>
                <select
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value as CandidateGroupType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:border-indigo-500 transition"
                >
                  <option value="GROUP_A">Group A (Rounds 1 &amp; 2 Eligible Pool)</option>
                  <option value="GROUP_B">Group B (Consolidation Pool)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Candidate Bio / Notes (Optional)
                </label>
                <textarea
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Additional background, titles, or community notes..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCandidate(null);
                  }}
                  disabled={formLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                >
                  {formLoading ? 'Saving...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

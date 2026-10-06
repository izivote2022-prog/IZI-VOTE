import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  Award,
  KeyRound,
  History,
  CheckSquare,
  ShieldCheck,
  Settings,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { ElectionDataStore, ElectionState } from '../../types/index.js';
import { ApiClient } from '../../services/api.js';
import { AdminOverview } from './AdminOverview.js';
import { CandidateManager } from './CandidateManager.js';
import { ConsolidationPanel } from './ConsolidationPanel.js';
import { ResultsView } from './ResultsView.js';
import { TokenManager } from './TokenManager.js';
import { AuditLogViewer } from './AuditLogViewer.js';
import { TestSuiteRunner } from './TestSuiteRunner.js';
import { SecurityReviewModal } from './SecurityReviewModal.js';
import { SettingsModal } from './SettingsModal.js';
import { TieResolutionModal } from './TieResolutionModal.js';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [adminState, setAdminState] = useState<
    (ElectionDataStore & { activeRound: any; consolidationSummary: any }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tie modal
  const [showTieModal, setShowTieModal] = useState(false);

  const fetchState = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await ApiClient.getAdminState();
      setAdminState(data);
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch administrator state.';
      setError(msg);
      const lower = msg.toLowerCase();
      if (
        lower.includes('unauthorized') ||
        lower.includes('session') ||
        lower.includes('expired') ||
        lower.includes('credentials')
      ) {
        onLogout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(() => fetchState(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTransitionState = async (
    newState: ElectionState,
    metadata?: Record<string, any>
  ) => {
    try {
      await ApiClient.transitionState(newState, metadata);
      await fetchState();
    } catch (err: any) {
      alert(err.message || 'State transition failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-medium">Loading Administrator Console...</p>
      </div>
    );
  }

  if (error || !adminState) {
    const isAuthError =
      error &&
      (error.toLowerCase().includes('unauthorized') ||
        error.toLowerCase().includes('session') ||
        error.toLowerCase().includes('expired') ||
        error.toLowerCase().includes('credentials'));

    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
          <p className="text-rose-400 text-sm font-semibold">{error || 'Failed to load console.'}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fetchState(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              Retry Connection
            </button>
            <button
              onClick={() => onLogout()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition"
            >
              {isAuthError ? 'Sign In Again' : 'Exit to Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'overview', label: 'Overview & Phases', icon: LayoutDashboard },
    {
      id: 'candidates',
      label: `Candidates (${adminState.candidates.length})`,
      icon: Users,
    },
    {
      id: 'consolidation',
      label: 'Consolidation (8+16=24)',
      icon: Layers,
      highlight: adminState.currentState === 'CONSOLIDATION_PENDING',
    },
    { id: 'results', label: 'Results & Certification', icon: Award },
    {
      id: 'tokens',
      label: `Tokens (${adminState.tokens.length})`,
      icon: KeyRound,
    },
    {
      id: 'audit',
      label: `Audit Trail (${adminState.auditLogs.length})`,
      icon: History,
    },
    { id: 'tests', label: '83 Test Suite', icon: CheckSquare },
    { id: 'security', label: 'Security Review', icon: ShieldCheck },
    { id: 'settings', label: 'Settings & Backup', icon: Settings },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Sub-bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs">
            ADM
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white">Administrator Command Center &bull; IZI 2027-2028 MAKAI DING KI TEL NA</h1>
            <p className="text-[11px] text-slate-400">
              Authenticated Session • Election ID: {adminState.electionId} • Rule: 2 Selections Per Ballot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchState(true)}
            disabled={refreshing}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition border border-transparent hover:border-slate-700"
            title="Refresh State"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : item.highlight
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-800 hover:bg-purple-900'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.highlight && <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'overview' && (
          <AdminOverview
            state={adminState}
            onTransitionState={handleTransitionState}
            onNavigateTab={setActiveTab}
            onOpenTieModal={() => setShowTieModal(true)}
            onRefresh={() => fetchState(true)}
          />
        )}

        {activeTab === 'candidates' && (
          <CandidateManager
            candidates={adminState.candidates}
            currentState={adminState.currentState}
            onRefresh={() => fetchState(true)}
          />
        )}

        {activeTab === 'consolidation' && (
          <ConsolidationPanel
            state={adminState}
            onRefresh={() => fetchState(true)}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'results' && <ResultsView state={adminState} />}

        {activeTab === 'tokens' && (
          <TokenManager
            tokens={adminState.tokens}
            currentState={adminState.currentState}
            rounds={adminState.rounds}
            tokenInventory={(adminState as any).tokenInventory}
            onRefresh={() => fetchState(true)}
          />
        )}

        {activeTab === 'audit' && <AuditLogViewer logs={adminState.auditLogs} />}

        {activeTab === 'tests' && <TestSuiteRunner />}

        {activeTab === 'security' && <SecurityReviewModal />}

        {activeTab === 'settings' && (
          <SettingsModal settings={adminState.settings} onRefresh={() => fetchState(true)} />
        )}
      </div>

      {/* Tie Resolution Modal */}
      {showTieModal && (
        <TieResolutionModal
          isOpen={showTieModal}
          onClose={() => setShowTieModal(false)}
          activeRound={adminState.activeRound}
          candidates={adminState.candidates}
          onResolved={async () => {
            await fetchState();
          }}
        />
      )}
    </div>
  );
};

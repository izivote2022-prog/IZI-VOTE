import React from 'react';
import {
  Vote,
  Search,
  Lock,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  viewMode: 'VOTER' | 'ADMIN';
  setViewMode: (mode: 'VOTER' | 'ADMIN') => void;
  currentState?: string;
  adminLoggedIn: boolean;
  onAdminLogout: () => void;
  onOpenReceiptModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  currentState = 'DRAFT',
  adminLoggedIn,
  onAdminLogout,
  onOpenReceiptModal,
}) => {
  const getPhaseDisplay = (state: string) => {
    switch (state) {
      case 'DRAFT':
        return { label: 'Draft Stage', color: 'bg-slate-800 text-slate-300 border-slate-700' };
      case 'ROUND_1_OPEN':
        return { label: 'Round 1: IZI Makai Pi (Open - 2 Selections)', color: 'bg-emerald-950 text-emerald-300 border-emerald-700 animate-pulse' };
      case 'ROUND_1_CLOSED':
        return { label: 'Round 1: Voting Closed', color: 'bg-amber-950 text-amber-300 border-amber-700' };
      case 'ROUND_1_FINALIZED':
        return { label: 'Round 1 Finalized', color: 'bg-blue-950 text-blue-300 border-blue-700' };
      case 'ROUND_2_OPEN':
        return { label: 'Round 2: Genvai Tanu Pi (Open - 2 Selections)', color: 'bg-emerald-950 text-emerald-300 border-emerald-700 animate-pulse' };
      case 'ROUND_2_CLOSED':
        return { label: 'Round 2: Voting Closed', color: 'bg-amber-950 text-amber-300 border-amber-700' };
      case 'ROUND_2_FINALIZED':
        return { label: 'Round 2 Finalized', color: 'bg-blue-950 text-blue-300 border-blue-700' };
      case 'CONSOLIDATION_PENDING':
        return { label: 'Consolidation Required (8 + 16 = 24)', color: 'bg-purple-950 text-purple-300 border-purple-700' };
      case 'FINAL_ROUND_OPEN':
        return { label: 'Round 3: Final Round (Open - 2 Selections)', color: 'bg-emerald-950 text-emerald-300 border-emerald-700 animate-pulse' };
      case 'FINAL_ROUND_CLOSED':
        return { label: 'Round 3: Voting Closed', color: 'bg-amber-950 text-amber-300 border-amber-700' };
      case 'FINAL_ROUND_FINALIZED':
        return { label: 'Round 3 Finalized: Top 7 Officers Assigned', color: 'bg-blue-950 text-blue-300 border-blue-700' };
      case 'COMPLETED':
        return { label: 'Election Certified & Concluded', color: 'bg-indigo-950 text-indigo-300 border-indigo-700' };
      default:
        return { label: state, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const phase = getPhaseDisplay(currentState);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold shrink-0">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                IZI 2027-2028 MAKAI DING KI TEL NA
              </span>
              <span className="hidden lg:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
                Official
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Community Election &amp; Auditable Voting System &bull; Rule: 2 Selections Per Ballot
            </p>
          </div>
        </div>

        {/* Center Current Phase Status */}
        <div className="hidden xl:flex items-center gap-2">
          <div className={`px-3 py-1 text-xs font-semibold rounded-full border ${phase.color} flex items-center gap-1.5 shadow-sm`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            {phase.label}
          </div>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenReceiptModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            title="Verify Ballot Receipt"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Verify Receipt</span>
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('VOTER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'VOTER'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Vote className="w-3.5 h-3.5" />
              <span>Voter Portal</span>
            </button>

            <button
              onClick={() => setViewMode('ADMIN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === 'ADMIN'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </button>
          </div>

          {viewMode === 'ADMIN' && adminLoggedIn && (
            <button
              onClick={onAdminLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-900/50 transition"
              title="Sign Out Admin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

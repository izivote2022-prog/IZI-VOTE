import React, { useState, useEffect } from 'react';
import { Navbar } from './components/common/Navbar.js';
import { ReceiptModal } from './components/common/ReceiptModal.js';
import { VoterView } from './components/voter/VoterView.js';
import { AdminLogin } from './components/admin/AdminLogin.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import { ApiClient } from './services/api.js';

export default function App() {
  const [viewMode, setViewMode] = useState<'VOTER' | 'ADMIN'>('VOTER');
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentState, setCurrentState] = useState<string>('DRAFT');

  // Verify and authenticate admin session on initial load
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const existingToken = ApiClient.getAdminToken();
      if (existingToken) {
        const session = await ApiClient.checkAdminSession();
        if (isMounted) {
          if (session?.username) {
            setAdminUsername(session.username);
          } else {
            ApiClient.clearAdminToken();
            setAdminUsername(null);
          }
        }
      } else {
        if (isMounted) {
          setAdminUsername(null);
        }
      }

      if (isMounted) {
        setIsCheckingAuth(false);
      }
    };

    checkSession();

    // Load initial election state
    ApiClient.getPublicElectionState()
      .then((data) => {
        if (isMounted && data?.currentState) {
          setCurrentState(data.currentState);
        }
      })
      .catch((err) => {
        console.error('Failed to get public status:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAdminLoginSuccess = (username: string) => {
    setAdminUsername(username);
  };

  const handleAdminLogout = async () => {
    try {
      await ApiClient.logoutAdmin();
    } catch (err) {
      console.warn('Logout API call failed:', err);
    } finally {
      ApiClient.clearAdminToken();
      setAdminUsername(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentState={currentState}
        adminLoggedIn={!!adminUsername}
        onAdminLogout={handleAdminLogout}
        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {viewMode === 'VOTER' && (
          <VoterView onOpenReceiptModal={() => setIsReceiptModalOpen(true)} />
        )}

        {viewMode === 'ADMIN' && (
          isCheckingAuth ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400">Verifying session...</p>
            </div>
          ) : adminUsername ? (
            <AdminDashboard onLogout={handleAdminLogout} />
          ) : (
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          )
        )}
      </main>

      {/* Public Receipt Verification Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            &copy; 2026-2028 IZI 2027-2028 MAKAI DING KI TEL NA. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>English Only Interface</span>
            <span>&bull;</span>
            <span>Cryptographically Audited</span>
            <span>&bull;</span>
            <span>Rule: 2 Selections Per Ballot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

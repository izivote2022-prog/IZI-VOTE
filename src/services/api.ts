import {
  ElectionDataStore,
  Candidate,
  RoundId,
  ElectionState,
  CandidateStatus,
  TestSuiteReport,
} from '../types/index.js';

const ADMIN_TOKEN_KEY = 'izi_election_admin_token';

export const ApiClient = {
  getAdminToken(): string | null {
    try {
      const token = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
        return null;
      }
      return token.trim();
    } catch {
      return null;
    }
  },

  setAdminToken(token: string) {
    try {
      if (token && token.trim() !== '') {
        localStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
      } else {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  },

  clearAdminToken() {
    try {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // Ignore storage errors
    }
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText || 'Unknown error'}`);
    }

    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.message || `Server request failed with status ${res.status}`);
    }

    return data.data !== undefined ? data.data : data;
  },

  // Check current admin session validity with server
  async checkAdminSession(): Promise<{ username: string; expiresAt: number } | null> {
    const token = this.getAdminToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/admin/session', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        this.clearAdminToken();
        return null;
      }

      const data = await res.json();
      if (data.success && data.data?.username) {
        return data.data;
      }

      this.clearAdminToken();
      return null;
    } catch {
      return null;
    }
  },

  // Public Voter API
  async getPublicElectionState(): Promise<any> {
    return this.request('/api/election/public');
  },

  async verifyVoterToken(payload: {
    roundId?: RoundId;
    tokenCode: string;
  }): Promise<{
    roundId: RoundId;
    roundName: string;
    electionName: string;
    ballotAllowed: boolean;
    message: string;
  }> {
    return this.request('/api/election/verify-token', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async submitVote(payload: {
    roundId: RoundId;
    candidateIds: string[]; // Exactly 2 candidate IDs
    tokenCode: string;
    clientFingerprint?: string;
  }): Promise<{
    message: string;
    verificationCode: string;
    timestamp: string;
    roundTitle: string;
    selectionCount: number;
    electionName: string;
  }> {
    return this.request('/api/election/vote', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyReceipt(code: string): Promise<any> {
    return this.request(`/api/election/verify-receipt/${encodeURIComponent(code)}`);
  },

  // Admin Auth API
  async loginAdmin(username: string, pass: string): Promise<{ token: string; username: string }> {
    const data = await this.request<{ token: string; username: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password: pass }),
    });
    this.setAdminToken(data.token);
    return data;
  },

  async logoutAdmin(): Promise<void> {
    try {
      const token = this.getAdminToken();
      if (token) {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Ignore network errors during logout
    } finally {
      this.clearAdminToken();
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.request('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Admin Election Management API
  async getAdminState(): Promise<ElectionDataStore & { activeRound: any; consolidationSummary: any }> {
    return this.request('/api/admin/state');
  },

  async transitionState(
    newState: ElectionState,
    metadata?: Record<string, any>
  ): Promise<{ currentState: ElectionState }> {
    return this.request('/api/admin/state/transition', {
      method: 'POST',
      body: JSON.stringify({ newState, metadata }),
    });
  },

  async confirmConsolidation(): Promise<{ message: string; totalPoolCount: number }> {
    return this.request('/api/admin/consolidation/confirm', {
      method: 'POST',
    });
  },

  async resetRound(payload: {
    roundId: RoundId | string;
    reason: string;
    confirmation: string;
    administrativeReason?: string;
  }): Promise<{ message: string; data?: any; [key: string]: any }> {
    return this.request('/api/admin/round/reset', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        administrativeReason: payload.reason,
      }),
    });
  },

  async getRoundChecklist(roundId: RoundId): Promise<any> {
    return this.request(`/api/admin/round/checklist/${roundId}`);
  },

  async addCandidate(payload: {
    name: string;
    group: 'GROUP_A' | 'GROUP_B';
    bio?: string;
  }): Promise<Candidate> {
    return this.request('/api/admin/candidates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async editCandidate(
    id: string,
    updates: { name?: string; group?: 'GROUP_A' | 'GROUP_B'; bio?: string }
  ): Promise<Candidate> {
    return this.request(`/api/admin/candidates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async setCandidateStatus(id: string, status: CandidateStatus): Promise<{ message: string }> {
    return this.request(`/api/admin/candidates/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async removeCandidate(id: string): Promise<{ message: string }> {
    return this.request(`/api/admin/candidates/${id}`, {
      method: 'DELETE',
    });
  },

  async generateTokens(payload: {
    roundId: RoundId;
    count: number;
    batchLabel: string;
  }): Promise<{ count: number; tokens: any[] }> {
    return this.request('/api/admin/tokens/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async regenerateTokens(payload: {
    roundId: RoundId;
    count: number;
    batchLabel: string;
  }): Promise<{ count: number; tokens: any[] }> {
    return this.request('/api/admin/tokens/regenerate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async confirmDistribution(roundId: RoundId): Promise<{ count: number }> {
    return this.request('/api/admin/tokens/confirm-distribution', {
      method: 'POST',
      body: JSON.stringify({ roundId }),
    });
  },

  async revokeToken(id: string, reason: string): Promise<{ message: string }> {
    return this.request(`/api/admin/tokens/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getTokenInventory(): Promise<{
    totalGenerated: number;
    distributed: number;
    unused: number;
    used: number;
    revoked: number;
    rounds: Record<RoundId, { total: number; distributed: number; unused: number; used: number; revoked: number }>;
  }> {
    return this.request('/api/admin/tokens/inventory');
  },

  async resolveTie(payload: {
    roundId: RoundId;
    chosenWinnerId: string;
    method: 'ADMIN_DECISION' | 'COMMITTEE_DRAW' | 'CERTIFIED_RUNOFF';
    notes: string;
  }): Promise<{ message: string }> {
    return this.request('/api/admin/tie/resolve', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAuditLogs(): Promise<{ totalEntries: number; logs: any[] }> {
    return this.request('/api/admin/audit-logs');
  },

  async updateSettings(settings: any): Promise<void> {
    return this.request('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    });
  },

  async resetElection(): Promise<{ message: string }> {
    return this.request('/api/admin/reset', {
      method: 'POST',
    });
  },

  async runTestSuite(): Promise<TestSuiteReport> {
    return this.request('/api/admin/test-suite/run', {
      method: 'POST',
    });
  },
};

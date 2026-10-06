import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ElectionDataStore,
  Candidate,
  ElectionRound,
  ElectionAuditLog,
  ElectionState,
  RoundId,
  Ballot,
  OFFICIAL_APP_NAME,
  FINAL_TOP_POSITIONS,
  ElectionMode,
  ElectionInstanceArchive,
} from '../types/index.js';

export { FINAL_TOP_POSITIONS, OFFICIAL_APP_NAME };

export const INITIAL_GROUP_A_NAMES = [
  'Pa. Pau Lam Lian',
  'Pa. Gin Neng Tuang',
  'Pa. Pau Dal Sing',
  'Pa. Tuan Kim Khai',
  'Pa. Kam Khan Khual',
  'Pa. Suan Than Sang',
  'Pa. Lian Zo Mung',
  'Pa. Dal Thian Thang',
  'Pa. Lam Khup',
  'Pa. Pau Kim Khai',
];

export const INITIAL_GROUP_B_NAMES = [
  'Pa. Piang Khan Mung (Pa. Piang)',
  'Pa. Cin Lam Khai (Cia Khai)',
  'Pa. Dal Sian Piang',
  'Pa. Kham Kim Thang (Thang No)',
  'Pa. Kham Kap Mang',
  'Tg. Pau Deih Tung',
  'Pa. Khen Suan Mung',
  'Pa. Khup Lam Kim',
  'Pa. Khai Cin Pau (Ploto Zam)',
  'Pa. Thang Khan Piang',
  'Pa. Thang Lam Kham',
  'Pa. Song Kim Mung',
  'Pa. Zam Khen Khup',
  'Pa. Hang Khan Khual',
  'Pa. Zam Gawh Lian',
  'Pa. Suan Gin Pau',
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'election_store.json');

export function createCandidatesList(): Candidate[] {
  const now = new Date().toISOString();
  const candidates: Candidate[] = [];

  // Group A candidates (10)
  INITIAL_GROUP_A_NAMES.forEach((name, index) => {
    candidates.push({
      id: `cand_a_${String(index + 1).padStart(2, '0')}`,
      name,
      group: 'GROUP_A',
      status: 'ACTIVE',
      orderIndex: index + 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  // Group B candidates (16)
  INITIAL_GROUP_B_NAMES.forEach((name, index) => {
    candidates.push({
      id: `cand_b_${String(index + 1).padStart(2, '0')}`,
      name,
      group: 'GROUP_B',
      status: 'ACTIVE',
      orderIndex: index + 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  return candidates;
}

export function createDefaultStore(instanceNumber = 1, mode: ElectionMode = 'TEST'): ElectionDataStore {
  const now = new Date().toISOString();
  const electionId = `elec_${String(instanceNumber).padStart(3, '0')}_${crypto.randomBytes(3).toString('hex')}`;
  const candidates = createCandidatesList();

  const groupACandidateIds = candidates
    .filter((c) => c.group === 'GROUP_A')
    .map((c) => c.id);

  const rounds: Record<RoundId, ElectionRound> = {
    ROUND_1: {
      id: 'ROUND_1',
      title: 'IZI Makai Pi',
      description: 'Election for IZI Makai Pi among eligible Group A candidates. Each voter selects exactly 2 candidates.',
      eligibleCandidateIds: groupACandidateIds,
      maxSelectionsPerVoter: 2,
      isOpened: false,
      isClosed: false,
      isFinalized: false,
      ballotsCast: 0,
      totalSelections: 0,
      totalVotes: 0,
      hasTie: false,
      tieStatus: 'NONE',
      electedPosition: 'IZI Makai Pi',
      isTokenBatchLocked: false,
    },
    ROUND_2: {
      id: 'ROUND_2',
      title: 'Genvai Tanu Pi',
      description: 'Election for Genvai Tanu Pi among remaining Group A candidates. Each voter selects exactly 2 candidates.',
      eligibleCandidateIds: [],
      maxSelectionsPerVoter: 2,
      isOpened: false,
      isClosed: false,
      isFinalized: false,
      ballotsCast: 0,
      totalSelections: 0,
      totalVotes: 0,
      hasTie: false,
      tieStatus: 'NONE',
      electedPosition: 'Genvai Tanu Pi',
      isTokenBatchLocked: false,
    },
    FINAL_ROUND: {
      id: 'FINAL_ROUND',
      title: 'Final Election - Community Leadership & Officers',
      description: 'Final voting for top 7 officer positions among consolidated 24 candidates. Each voter selects exactly 2 candidates.',
      eligibleCandidateIds: [],
      maxSelectionsPerVoter: 2,
      isOpened: false,
      isClosed: false,
      isFinalized: false,
      ballotsCast: 0,
      totalSelections: 0,
      totalVotes: 0,
      hasTie: false,
      tieStatus: 'NONE',
      isTokenBatchLocked: false,
    },
  };

  const genesisLog: ElectionAuditLog = {
    id: 'audit_genesis',
    timestamp: now,
    adminUser: 'System',
    action: `${OFFICIAL_APP_NAME} Instance #${instanceNumber} Initialized (${mode} Mode)`,
    stateBefore: 'DRAFT',
    stateAfter: 'DRAFT',
    metadata: {
      instanceNumber,
      mode,
      initialGroupACount: INITIAL_GROUP_A_NAMES.length,
      initialGroupBCount: INITIAL_GROUP_B_NAMES.length,
      votingRule: 'Each voter selects exactly 2 candidates',
    },
    entryHash: '',
    previousEntryHash: '0000000000000000000000000000000000000000000000000000000000000000',
  };

  genesisLog.entryHash = computeAuditHash(genesisLog);

  const initialBallots: Ballot[] = [];

  return {
    electionId,
    instanceNumber,
    electionName: OFFICIAL_APP_NAME,
    mode,
    currentState: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    settings: {
      electionName: OFFICIAL_APP_NAME,
      organizationName: 'IZI Community Organization',
      allowPublicLiveResults: false,
      strictDuplicateProtection: true,
      adminEmail: 'izivote.2022@gmail.com',
      votingRuleDescription: 'Each voter selects exactly 2 candidates.',
    },
    candidates,
    rounds,
    ballots: initialBallots,
    votes: initialBallots,
    tokens: [],
    auditLogs: [genesisLog],
    results: {},
    archivedInstances: [],
  };
}

export function computeAuditHash(log: Omit<ElectionAuditLog, 'entryHash'>): string {
  const content = [
    log.id,
    log.timestamp,
    log.adminUser,
    log.action,
    log.stateBefore,
    log.stateAfter,
    log.affectedCandidateId || '',
    log.affectedRound || '',
    JSON.stringify(log.metadata || {}),
    log.previousEntryHash,
  ].join('||');
  return crypto.createHash('sha256').update(content).digest('hex');
}

class Database {
  private store: ElectionDataStore;
  private isSaving = false;
  private saveQueue: Array<() => void> = [];

  constructor() {
    this.store = this.loadOrInit();
  }

  private loadOrInit(): ElectionDataStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as ElectionDataStore;
        if (parsed.electionId && parsed.candidates && parsed.rounds) {
          parsed.electionName = OFFICIAL_APP_NAME;
          if (!parsed.mode) parsed.mode = 'TEST';
          if (!parsed.instanceNumber) parsed.instanceNumber = 1;
          if (!parsed.ballots) parsed.ballots = parsed.votes || [];
          parsed.votes = parsed.ballots;
          if (!parsed.archivedInstances) parsed.archivedInstances = [];
          Object.values(parsed.rounds).forEach((r) => {
            r.maxSelectionsPerVoter = 2;
            if (r.ballotsCast === undefined) r.ballotsCast = r.totalVotes || 0;
            if (r.totalSelections === undefined) r.totalSelections = r.ballotsCast * 2;
            if (!r.tieStatus) r.tieStatus = r.hasTie ? 'TIE_REQUIRES_ADMIN_ACTION' : 'NONE';
            if (r.isTokenBatchLocked === undefined) r.isTokenBatchLocked = false;
          });
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load existing database store, initializing default:', err);
    }

    const defaultStore = createDefaultStore(1, 'TEST');
    this.persistSync(defaultStore);
    return defaultStore;
  }

  private persistSync(data: ElectionDataStore) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = DB_FILE + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, DB_FILE);
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  public getStore(): Readonly<ElectionDataStore> {
    return this.store;
  }

  public async updateStore<T>(mutator: (draft: ElectionDataStore) => T): Promise<T> {
    const result = mutator(this.store);
    this.store.updatedAt = new Date().toISOString();
    this.store.votes = this.store.ballots;
    await this.persist();
    return result;
  }

  public addAuditLog(
    adminUser: string,
    action: string,
    stateBefore: ElectionState,
    stateAfter: ElectionState,
    options?: {
      affectedCandidateId?: string;
      affectedCandidateName?: string;
      affectedRound?: RoundId;
      metadata?: Record<string, any>;
    }
  ): ElectionAuditLog {
    const lastLog = this.store.auditLogs[this.store.auditLogs.length - 1];
    const previousEntryHash = lastLog
      ? lastLog.entryHash
      : '0000000000000000000000000000000000000000000000000000000000000000';

    const newLogPartial: Omit<ElectionAuditLog, 'entryHash'> = {
      id: 'audit_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      timestamp: new Date().toISOString(),
      adminUser,
      action,
      stateBefore,
      stateAfter,
      affectedCandidateId: options?.affectedCandidateId,
      affectedCandidateName: options?.affectedCandidateName,
      affectedRound: options?.affectedRound,
      metadata: options?.metadata,
      previousEntryHash,
    };

    const entryHash = computeAuditHash(newLogPartial);
    const completeLog: ElectionAuditLog = {
      ...newLogPartial,
      entryHash,
    };

    this.store.auditLogs.push(completeLog);
    return completeLog;
  }

  /**
   * Reset a TEST election.
   * STRICT ENFORCEMENT: Never allowed on a LIVE election.
   * Retains the entire immutable audit trail!
   */
  public resetTestElection(adminUser: string, reason: string): { success: boolean; error?: string } {
    if (this.store.mode === 'LIVE') {
      return {
        success: false,
        error: 'Live election cannot be reset. Live election protection is active.',
      };
    }

    const previousState = this.store.currentState;
    const now = new Date().toISOString();

    // Reset candidates to initial active pool
    this.store.candidates = createCandidatesList();
    const groupACandidateIds = this.store.candidates
      .filter((c) => c.group === 'GROUP_A')
      .map((c) => c.id);

    // Reset rounds
    this.store.rounds.ROUND_1 = {
      id: 'ROUND_1',
      title: 'IZI Makai Pi',
      description: 'Election for IZI Makai Pi among eligible Group A candidates. Each voter selects exactly 2 candidates.',
      eligibleCandidateIds: groupACandidateIds,
      maxSelectionsPerVoter: 2,
      isOpened: false,
      isClosed: false,
      isFinalized: false,
      ballotsCast: 0,
      totalSelections: 0,
      totalVotes: 0,
      hasTie: false,
      tieStatus: 'NONE',
      electedPosition: 'IZI Makai Pi',
      isTokenBatchLocked: false,
    };

    this.store.rounds.ROUND_2 = {
      id: 'ROUND_2',
      title: 'Genvai Tanu Pi',
      description: 'Election for Genvai Tanu Pi among remaining Group A candidates. Each voter selects exactly 2 candidates.',
      eligibleCandidateIds: [],
      maxSelectionsPerVoter: 2,
      isOpened: false,
      isClosed: false,
      isFinalized: false,
      ballotsCast: 0,
      totalSelections: 0,
      totalVotes: 0,
      hasTie: false,
      tieStatus: 'NONE',
      electedPosition: 'Genvai Tanu Pi',
      isTokenBatchLocked: false,
    };

    this.store.rounds.FINAL_ROUND = {
      id: 'FINAL_ROUND',
      title: 'Final Election - Community Leadership & Officers',
      description: 'Final voting for top 7 officer positions among consolidated 24 candidates. Each voter selects exactly 2 candidates.',
      eligibleCandidateIds: [],
      maxSelectionsPerVoter: 2,
      isOpened: false,
      isClosed: false,
      isFinalized: false,
      ballotsCast: 0,
      totalSelections: 0,
      totalVotes: 0,
      hasTie: false,
      tieStatus: 'NONE',
      isTokenBatchLocked: false,
    };

    // Invalidate tokens and clear test ballots
    this.store.tokens = [];
    this.store.ballots = [];
    this.store.votes = [];
    this.store.results = {};
    this.store.certifiedAt = undefined;
    this.store.certifiedBy = undefined;
    this.store.currentState = 'DRAFT';
    this.store.updatedAt = now;

    // IMMUTABLE AUDIT LOG SURVIVES AND RECORDS RESET
    this.addAuditLog(adminUser, 'TEST_ELECTION_RESET', previousState, 'DRAFT', {
      metadata: {
        reason: reason || 'Administrator executed authorized test reset',
        mode: 'TEST',
      },
    });

    this.persistSync(this.store);
    return { success: true };
  }

  /**
   * Cancel/Void a LIVE election.
   * Requires exact confirmation phrase: "VOID LIVE ELECTION"
   * Archives previous instance and spins up new instance #002 preserving all audit logs.
   */
  public voidLiveElection(
    adminUser: string,
    reason: string,
    confirmationPhrase: string
  ): { success: boolean; error?: string; newInstanceNumber?: number } {
    if (confirmationPhrase !== 'VOID LIVE ELECTION') {
      return {
        success: false,
        error: 'Confirmation phrase mismatch. You must type exactly: VOID LIVE ELECTION',
      };
    }

    const now = new Date().toISOString();
    const oldInstanceNumber = this.store.instanceNumber;
    const oldElectionId = this.store.electionId;

    const archiveItem: ElectionInstanceArchive = {
      instanceNumber: oldInstanceNumber,
      electionId: oldElectionId,
      mode: 'VOIDED',
      voidedAt: now,
      voidedBy: adminUser,
      voidReason: reason || 'Live election cancelled by administrative authority',
      ballotsCount: this.store.ballots.length,
      auditLogsCount: this.store.auditLogs.length,
    };

    if (!this.store.archivedInstances) {
      this.store.archivedInstances = [];
    }
    this.store.archivedInstances.push(archiveItem);

    const newInstanceNumber = oldInstanceNumber + 1;

    // Add audit log BEFORE switching instance
    this.addAuditLog(adminUser, `LIVE_ELECTION_VOIDED (Instance #${oldInstanceNumber})`, this.store.currentState, 'DRAFT', {
      metadata: {
        voidReason: reason,
        newInstanceNumber,
      },
    });

    // Create fresh instance while keeping existing audit logs and archives
    const fresh = createDefaultStore(newInstanceNumber, 'DRAFT' as any);
    fresh.mode = 'TEST'; // New instance starts in TEST mode so admin can prepare
    fresh.archivedInstances = this.store.archivedInstances;
    fresh.auditLogs = this.store.auditLogs; // FULL AUDIT HISTORY SURVIVES

    this.store = fresh;
    this.persistSync(this.store);

    return {
      success: true,
      newInstanceNumber,
    };
  }

  /**
   * Switch mode between TEST and LIVE
   */
  public switchMode(newMode: 'TEST' | 'LIVE', adminUser: string): { success: boolean; error?: string } {
    if (this.store.mode === newMode) return { success: true };

    const oldMode = this.store.mode;
    this.store.mode = newMode;
    this.addAuditLog(adminUser, `Election Mode Changed (${oldMode} -> ${newMode})`, this.store.currentState, this.store.currentState, {
      metadata: { oldMode, newMode },
    });
    this.persistSync(this.store);
    return { success: true };
  }

  /**
   * Reset store to pristine default state
   */
  public resetToDefault(adminUser: string = 'admin'): void {
    const nextInstance = (this.store?.instanceNumber || 1) + 1;
    this.store = createDefaultStore(nextInstance, this.store?.mode || 'TEST');
    this.addAuditLog(adminUser, 'Election Reset to Default State', 'DRAFT', 'DRAFT', {
      metadata: { instanceNumber: nextInstance },
    });
    this.persistSync(this.store);
  }

  private async persist(): Promise<void> {
    if (this.isSaving) {
      return new Promise<void>((resolve) => {
        this.saveQueue.push(resolve);
      });
    }

    this.isSaving = true;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = DB_FILE + '.tmp';
      await fs.promises.writeFile(tmpPath, JSON.stringify(this.store, null, 2), 'utf-8');
      await fs.promises.rename(tmpPath, DB_FILE);
    } catch (err) {
      console.error('Failed to save store to file:', err);
    } finally {
      this.isSaving = false;
      if (this.saveQueue.length > 0) {
        const next = this.saveQueue.shift();
        if (next) {
          next();
          this.persist();
        }
      }
    }
  }
}

export const db = new Database();

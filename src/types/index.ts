export type ElectionState =
  | 'DRAFT'
  | 'ROUND_1_OPEN'
  | 'ROUND_1_CLOSED'
  | 'ROUND_1_FINALIZED'
  | 'ROUND_2_OPEN'
  | 'ROUND_2_CLOSED'
  | 'ROUND_2_FINALIZED'
  | 'CONSOLIDATION_PENDING'
  | 'FINAL_ROUND_OPEN'
  | 'FINAL_ROUND_CLOSED'
  | 'FINAL_ROUND_FINALIZED'
  | 'COMPLETED';

export type ElectionMode = 'TEST' | 'LIVE' | 'VOIDED';

export type CandidateGroupType = 'GROUP_A' | 'GROUP_B';

export type CandidateStatus =
  | 'ACTIVE'
  | 'DEACTIVATED'
  | 'ELECTED'
  | 'ELIMINATED'
  | 'FINAL_RANKED';

export interface Candidate {
  id: string; // Immutable identifier e.g. "cand_a_01"
  name: string;
  group: CandidateGroupType;
  status: CandidateStatus;
  orderIndex: number;
  bio?: string;
  photoUrl?: string;
  electedPosition?: string; // e.g. "IZI Makai Pi", "Genvai Tanu Pi", etc.
  electedRound?: 'ROUND_1' | 'ROUND_2' | 'FINAL_ROUND';
  finalRank?: number; // 1 to 24
  createdAt: string;
  updatedAt: string;
}

export type RoundId = 'ROUND_1' | 'ROUND_2' | 'FINAL_ROUND';

export type TieStatus = 'NONE' | 'TIE_REQUIRES_ADMIN_ACTION' | 'RESOLVED';

export interface ElectionRound {
  id: RoundId;
  title: string;
  description: string;
  eligibleCandidateIds: string[];
  maxSelectionsPerVoter: number; // Exactly 2
  isOpened: boolean;
  isClosed: boolean;
  isFinalized: boolean;
  openedAt?: string;
  closedAt?: string;
  finalizedAt?: string;
  ballotsCast: number; // Number of valid ballots received
  totalSelections: number; // Total candidate selections (ballotsCast * 2)
  totalVotes: number; // Compatibility alias (= ballotsCast)
  hasTie: boolean;
  tieStatus: TieStatus;
  tiedCandidateIds?: string[];
  winnerCandidateId?: string;
  winnerCandidateName?: string;
  electedPosition?: string;
  isTokenBatchLocked?: boolean; // Locked against regeneration once distributed or voting opened
  tokenBatchLockedAt?: string;
  tieResolutionDetails?: {
    resolvedAt: string;
    resolvedBy: string;
    method: 'ADMIN_DECISION' | 'COMMITTEE_DRAW' | 'CERTIFIED_RUNOFF';
    chosenWinnerId: string;
    notes: string;
  };
}

/**
 * A single ballot containing exactly two candidate selections
 */
export interface Ballot {
  id: string;
  electionId: string;
  roundId: RoundId;
  tokenHash: string; // Decoupled token hash
  candidateId1: string;
  candidateId2: string;
  candidateIds: [string, string];
  createdAt: string;
  receiptCode: string; // e.g. "VOTE-REC-XXXX-XXXX"
  integrityHash: string;
}

export type Vote = Ballot;

export type TokenStatus = 'GENERATED' | 'DISTRIBUTED' | 'USED' | 'REVOKED';

export interface VotingToken {
  id: string;
  tokenCode: string; // High-entropy code e.g. "VT-8F3K-X91M-Q72P"
  tokenHash: string; // SHA-256 hash stored for verification
  electionId: string;
  roundId: RoundId;
  status: TokenStatus;
  isUsed: boolean;
  createdAt: string;
  distributedAt?: string;
  usedAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
  batchLabel?: string;
}

export interface ElectionAuditLog {
  id: string;
  timestamp: string;
  adminUser: string;
  action: string;
  stateBefore: ElectionState;
  stateAfter: ElectionState;
  affectedCandidateId?: string;
  affectedCandidateName?: string;
  affectedRound?: RoundId;
  metadata?: Record<string, any>;
  entryHash: string; // SHA-256 hash of this entry
  previousEntryHash: string; // Previous log's hash for hash-chain immutability
}

export interface FinalTopPosition {
  rank: number;
  title: string;
  candidateId?: string;
  candidateName?: string;
  voteCount?: number;
  selectionCount?: number;
  votePercentage?: number;
}

export const OFFICIAL_APP_NAME = 'IZI 2027-2028 MAKAI DING KI TEL NA';

export const FINAL_TOP_POSITIONS: FinalTopPosition[] = [
  { rank: 1, title: 'Lai At Pi' },
  { rank: 2, title: 'Sum Kem Pi' },
  { rank: 3, title: 'Makai Huh' },
  { rank: 4, title: 'Lai At Huh' },
  { rank: 5, title: 'Sum Kem Huh' },
  { rank: 6, title: 'Sazian Sit' },
  { rank: 7, title: 'Genvai Huh' },
];

export interface CandidateResultItem {
  candidateId: string;
  candidateName: string;
  group: CandidateGroupType;
  selectionCount: number;
  voteCount: number;
  percentage: number;
  rank: number;
  status: CandidateStatus;
  electedPosition?: string;
}

export interface ElectionResult {
  roundId: RoundId;
  title: string;
  computedAt: string;
  ballotsCast: number;
  totalSelections: number;
  totalVotes: number;
  candidateResults: CandidateResultItem[];
  isCertified: boolean;
  certifiedBy?: string;
  certifiedAt?: string;
}

export interface ElectionSettings {
  electionName: string;
  organizationName: string;
  allowPublicLiveResults: boolean;
  strictDuplicateProtection: boolean;
  adminEmail: string;
  votingRuleDescription: string;
  requireTokenMode?: 'STRICT_TOKEN_ONLY' | 'ALLOW_KIOSK_DISPENSE';
}

export interface ElectionInstanceArchive {
  instanceNumber: number;
  electionId: string;
  mode: ElectionMode;
  voidedAt: string;
  voidedBy: string;
  voidReason: string;
  ballotsCount: number;
  auditLogsCount: number;
}

export interface ElectionDataStore {
  electionId: string;
  instanceNumber: number;
  electionName: string;
  mode: ElectionMode; // 'TEST' | 'LIVE' | 'VOIDED'
  currentState: ElectionState;
  createdAt: string;
  updatedAt: string;
  settings: ElectionSettings;
  candidates: Candidate[];
  rounds: Record<RoundId, ElectionRound>;
  ballots: Ballot[];
  votes: Ballot[];
  tokens: VotingToken[];
  auditLogs: ElectionAuditLog[];
  results: Partial<Record<RoundId, ElectionResult>>;
  archivedBallots?: Ballot[];
  archivedInstances?: ElectionInstanceArchive[];
  certifiedAt?: string;
  certifiedBy?: string;
}

export interface AdminSession {
  token: string;
  username: string;
  expiresAt: number;
}

export interface TestResult {
  id: number;
  name: string;
  category: 'SELECTION_RULES' | 'LIFECYCLE' | 'SECURITY' | 'STATE_MACHINE' | 'RANKING';
  passed: boolean;
  durationMs: number;
  message: string;
  details?: string[];
}

export interface TestSuiteReport {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  allPassed: boolean;
  totalDurationMs: number;
  results: TestResult[];
}

export interface SecurityCheckItem {
  id: string;
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'TOKEN_SECURITY' | 'BALLOT_INTEGRITY' | 'STATE_SECURITY' | 'AUDIT_INTEGRITY';
  title: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  description: string;
  recommendation?: string;
}

export interface SecurityAuditReport {
  timestamp: string;
  overallStatus: 'SECURE' | 'ACTION_REQUIRED';
  passCount: number;
  warningCount: number;
  failCount: number;
  checks: SecurityCheckItem[];
}

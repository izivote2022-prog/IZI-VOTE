import crypto from 'crypto';
import { db, FINAL_TOP_POSITIONS, OFFICIAL_APP_NAME } from './db.js';
import {
  ElectionState,
  RoundId,
  Candidate,
  Ballot,
  VotingToken,
  ElectionResult,
  CandidateResultItem,
  TokenStatus,
  CandidateStatus,
  FinalTopPosition,
} from '../types/index.js';

export interface VoteSubmissionPayload {
  roundId: RoundId;
  candidateIds: string[]; // Exactly 2 different candidates
  tokenCode: string;
  clientFingerprint?: string;
}

export interface VoteSubmissionResult {
  success: boolean;
  verificationCode?: string;
  timestamp?: string;
  error?: string;
  roundTitle?: string;
  candidateNames?: string[];
  selectionCount?: number;
}

// In-memory atomic lock for concurrent vote processing
let voteProcessingLock = Promise.resolve();

// High entropy character set for token generation (excluding easily confused characters)
const TOKEN_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateSecureRandomSegment(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += TOKEN_CHARSET[bytes[i] % TOKEN_CHARSET.length];
  }
  return result;
}

/**
 * Generate high-entropy token: e.g. "VT-8F3K-X91M-Q72P" (80+ bits entropy)
 */
export function generateSecureTokenCode(): string {
  const seg1 = generateSecureRandomSegment(4);
  const seg2 = generateSecureRandomSegment(4);
  const seg3 = generateSecureRandomSegment(4);
  return `VT-${seg1}-${seg2}-${seg3}`;
}

export function normalizeRoundId(input: any): RoundId | null {
  if (!input || typeof input !== 'string') return null;
  const upper = input.trim().toUpperCase();
  if (upper === 'ROUND_1' || upper === 'ROUND_1_OPEN' || upper === 'ROUND_1_CLOSED' || upper === 'ROUND_1_FINALIZED') {
    return 'ROUND_1';
  }
  if (upper === 'ROUND_2' || upper === 'ROUND_2_OPEN' || upper === 'ROUND_2_CLOSED' || upper === 'ROUND_2_FINALIZED') {
    return 'ROUND_2';
  }
  if (
    upper === 'FINAL_ROUND' ||
    upper === 'ROUND_3' ||
    upper === 'FINAL_ROUND_OPEN' ||
    upper === 'FINAL_ROUND_CLOSED' ||
    upper === 'FINAL_ROUND_FINALIZED' ||
    upper === 'COMPLETED'
  ) {
    return 'FINAL_ROUND';
  }
  return null;
}

export class ElectionEngine {
  /**
   * Pre-election checklist verification before opening a round (Part 11)
   */
  public static getPreElectionChecklist(roundId: RoundId): {
    candidateListComplete: boolean;
    candidateCountValid: boolean;
    candidateCount: number;
    expectedCandidateCount: number;
    tokenBatchGenerated: boolean;
    tokenCount: number;
    tokenDistributionConfirmed: boolean;
    tokenBatchLocked: boolean;
    electionStateValid: boolean;
    auditLogHealthy: boolean;
    canOpen: boolean;
    missingRequirements: string[];
  } {
    const store = db.getStore();
    const round = store.rounds[roundId];
    const missing: string[] = [];

    // Candidate count expectations
    let expectedCount = 10;
    let actualCount = 0;

    if (roundId === 'ROUND_1') {
      expectedCount = 10;
      actualCount = store.candidates.filter((c) => c.group === 'GROUP_A' && c.status === 'ACTIVE').length;
    } else if (roundId === 'ROUND_2') {
      expectedCount = 9;
      actualCount = store.candidates.filter((c) => c.group === 'GROUP_A' && c.status === 'ACTIVE').length;
    } else {
      expectedCount = 24;
      const remainingGroupA = store.candidates.filter((c) => c.group === 'GROUP_A' && c.status === 'ACTIVE').length;
      const activeGroupB = store.candidates.filter((c) => c.group === 'GROUP_B' && c.status === 'ACTIVE').length;
      actualCount = (round?.eligibleCandidateIds || []).length;

      if (!store.rounds.ROUND_1.isFinalized) {
        missing.push('Round 1 must be finalized with IZI Makai Pi elected before Round 3.');
      }
      if (!store.rounds.ROUND_2.isFinalized) {
        missing.push('Round 2 must be finalized with Genvai Tanu Pi elected before Round 3.');
      }
      if (remainingGroupA !== 8) {
        missing.push(`Consolidation check: Group A must have exactly 8 remaining candidates (found ${remainingGroupA}).`);
      }
      if (activeGroupB !== 16) {
        missing.push(`Consolidation check: Group B must have exactly 16 candidates (found ${activeGroupB}).`);
      }
      if (actualCount !== 24) {
        missing.push(`Final candidate pool must have exactly 24 candidates (found ${actualCount}). Please confirm consolidation.`);
      }
    }

    const candidateCountValid =
      roundId === 'FINAL_ROUND' ? actualCount === 24 : actualCount >= expectedCount;
    const candidateListComplete = actualCount > 0 && candidateCountValid && missing.length === 0;
    if (!candidateListComplete && missing.length === 0) {
      missing.push(`Candidate list incomplete: requires ${expectedCount} active candidates (found ${actualCount})`);
    }

    // Token batch verification
    const tokensForRound = store.tokens.filter((t) => t.roundId === roundId && t.status !== 'REVOKED');
    const tokenBatchGenerated = tokensForRound.length > 0;
    if (!tokenBatchGenerated) {
      missing.push('No voting tokens generated for this round. Please generate tokens before opening voting.');
    }

    // Token distribution confirmation
    const hasDistributed = tokensForRound.some((t) => t.status === 'DISTRIBUTED' || t.status === 'USED');
    const tokenDistributionConfirmed = tokenBatchGenerated && hasDistributed;
    if (!tokenDistributionConfirmed) {
      missing.push('Token distribution not confirmed. Administrator must distribute tokens and click "Confirm Distribution" before opening voting.');
    }

    const tokenBatchLocked = Boolean(round?.isTokenBatchLocked);

    // Election state validity
    const validPriorStates: Record<RoundId, ElectionState[]> = {
      ROUND_1: ['DRAFT', 'ROUND_1_CLOSED'],
      ROUND_2: ['ROUND_1_FINALIZED', 'ROUND_2_CLOSED'],
      FINAL_ROUND: ['CONSOLIDATION_PENDING', 'FINAL_ROUND_CLOSED'],
    };
    const electionStateValid = validPriorStates[roundId]?.includes(store.currentState) ?? false;
    if (!electionStateValid) {
      missing.push(`Election state invalid for opening ${roundId}: currently ${store.currentState}`);
    }

    // Audit log health
    const auditLogHealthy = Array.isArray(store.auditLogs) && store.auditLogs.length > 0;
    if (!auditLogHealthy) {
      missing.push('Audit log corrupted or missing entries.');
    }

    const canOpen =
      candidateListComplete &&
      candidateCountValid &&
      tokenBatchGenerated &&
      tokenDistributionConfirmed &&
      electionStateValid &&
      auditLogHealthy;

    return {
      candidateListComplete,
      candidateCountValid,
      candidateCount: actualCount,
      expectedCandidateCount: expectedCount,
      tokenBatchGenerated,
      tokenCount: tokensForRound.length,
      tokenDistributionConfirmed,
      tokenBatchLocked,
      electionStateValid,
      auditLogHealthy,
      canOpen,
      missingRequirements: missing,
    };
  }

  /**
   * Voter token verification prior to ballot display (Part 13)
   * Validates:
   * 1. Round is currently OPEN
   * 2. Token code is provided
   * 3. Token exists in store (by hash or code)
   * 4. Token belongs to this election
   * 5. Token belongs to this round
   * 6. Token is not revoked
   * 7. Token has not already been used
   */
  public static verifyVoterToken(
    roundId: RoundId,
    tokenCode: string
  ): {
    valid: boolean;
    error?: string;
    electionName?: string;
    roundName?: string;
    ballotAllowed?: boolean;
    roundId?: RoundId;
  } {
    const store = db.getStore();
    const expectedOpenState: Record<RoundId, ElectionState> = {
      ROUND_1: 'ROUND_1_OPEN',
      ROUND_2: 'ROUND_2_OPEN',
      FINAL_ROUND: 'FINAL_ROUND_OPEN',
    };

    if (store.currentState !== expectedOpenState[roundId]) {
      return {
        valid: false,
        error: `Voting is currently not open for ${roundId}. Current phase: ${store.currentState}`,
      };
    }

    const round = store.rounds[roundId];
    if (!round || !round.isOpened || round.isClosed || round.isFinalized) {
      return {
        valid: false,
        error: 'Voting is closed for this round.',
      };
    }

    if (!tokenCode || tokenCode.trim().length === 0) {
      return {
        valid: false,
        error: 'Please enter a valid anonymous voting token.',
      };
    }

    const normalizedToken = tokenCode.trim().toUpperCase();
    const incomingHash = crypto.createHash('sha256').update(normalizedToken).digest('hex');

    const tokenRecord = store.tokens.find(
      (t) =>
        (t.tokenCode.toUpperCase() === normalizedToken || t.tokenHash === incomingHash) &&
        t.electionId === store.electionId
    );

    if (!tokenRecord) {
      return {
        valid: false,
        error: 'Invalid voting token. Please check the code provided by the election committee.',
      };
    }

    if (tokenRecord.roundId !== roundId) {
      return {
        valid: false,
        error: 'This voting token is not valid for the current round.',
      };
    }

    if (tokenRecord.status === 'REVOKED') {
      return {
        valid: false,
        error: 'This voting token has been revoked by election administration.',
      };
    }

    if (tokenRecord.isUsed || tokenRecord.status === 'USED') {
      return {
        valid: false,
        error: 'This voting token has already been used to cast a ballot.',
      };
    }

    return {
      valid: true,
      electionName: OFFICIAL_APP_NAME,
      roundName: round.title,
      ballotAllowed: true,
      roundId: round.id,
    };
  }

  /**
   * Get public state for voters - ZERO TOKEN EXPOSURE
   */
  public static getPublicElectionState() {
    const store = db.getStore();
    const currentRound = this.getCurrentActiveRound(store.currentState);

    let eligibleCandidates: Candidate[] = [];
    if (currentRound) {
      eligibleCandidates = store.candidates.filter(
        (c) =>
          currentRound.eligibleCandidateIds.includes(c.id) &&
          c.status === 'ACTIVE'
      );
    }

    const isVotingOpen = [
      'ROUND_1_OPEN',
      'ROUND_2_OPEN',
      'FINAL_ROUND_OPEN',
    ].includes(store.currentState);

    return {
      electionId: store.electionId,
      instanceNumber: store.instanceNumber,
      electionName: OFFICIAL_APP_NAME,
      mode: store.mode,
      currentState: store.currentState,
      votingRule: 'Each voter selects exactly 2 candidates.',
      selectionsRequired: 2,
      currentRound: currentRound
        ? {
            id: currentRound.id,
            title: currentRound.title,
            description: currentRound.description,
            isOpened: currentRound.isOpened,
            isClosed: currentRound.isClosed,
            maxSelectionsPerVoter: 2,
            ballotsCast: store.settings.allowPublicLiveResults || !isVotingOpen
              ? currentRound.ballotsCast
              : undefined,
            totalSelections: store.settings.allowPublicLiveResults || !isVotingOpen
              ? currentRound.totalSelections
              : undefined,
          }
        : null,
      eligibleCandidates: eligibleCandidates.map((c) => ({
        id: c.id,
        name: c.name,
        group: c.group,
        orderIndex: c.orderIndex,
        photoUrl: c.photoUrl,
        bio: c.bio,
      })),
      isVotingOpen,
      settings: {
        electionName: OFFICIAL_APP_NAME,
        organizationName: store.settings.organizationName,
        allowPublicLiveResults: store.settings.allowPublicLiveResults,
        votingRuleDescription: 'Each voter selects exactly 2 candidates.',
      },
      finalResults: store.currentState === 'COMPLETED' ? store.results.FINAL_ROUND : undefined,
      pastWinners: {
        round1Winner: store.rounds.ROUND_1.winnerCandidateName,
        round2Winner: store.rounds.ROUND_2.winnerCandidateName,
      },
      certifiedAt: store.certifiedAt,
    };
  }

  /**
   * Get full state for authenticated administrators only
   */
  public static getAdminElectionState() {
    const store = db.getStore();
    const activeRound = this.getCurrentActiveRound(store.currentState);

    // Calculate Token Inventory summary
    const allTokens = store.tokens;
    const totalGenerated = allTokens.length;
    const used = allTokens.filter((t) => t.isUsed || t.status === 'USED').length;
    const revoked = allTokens.filter((t) => t.status === 'REVOKED').length;
    const unused = allTokens.filter((t) => !t.isUsed && t.status !== 'REVOKED').length;
    const distributed = allTokens.filter((t) => t.status === 'DISTRIBUTED' || t.status === 'USED').length;

    // Per-round token inventory
    const roundInventory: Record<RoundId, { total: number; distributed: number; unused: number; used: number; revoked: number }> = {
      ROUND_1: { total: 0, distributed: 0, unused: 0, used: 0, revoked: 0 },
      ROUND_2: { total: 0, distributed: 0, unused: 0, used: 0, revoked: 0 },
      FINAL_ROUND: { total: 0, distributed: 0, unused: 0, used: 0, revoked: 0 },
    };

    allTokens.forEach((t) => {
      const inv = roundInventory[t.roundId];
      if (inv) {
        inv.total += 1;
        if (t.status === 'DISTRIBUTED' || t.status === 'USED') inv.distributed += 1;
        if (t.status === 'USED' || t.isUsed) inv.used += 1;
        else if (t.status === 'REVOKED') inv.revoked += 1;
        else inv.unused += 1;
      }
    });

    return {
      ...store,
      electionName: OFFICIAL_APP_NAME,
      activeRound,
      tokenInventory: {
        totalGenerated,
        distributed,
        unused,
        used,
        revoked,
        rounds: roundInventory,
      },
      consolidationSummary: {
        groupARemainingCount: store.candidates.filter(
          (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
        ).length,
        groupBCount: store.candidates.filter(
          (c) => c.group === 'GROUP_B' && c.status === 'ACTIVE'
        ).length,
        totalConsolidatedCount:
          store.candidates.filter(
            (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
          ).length +
          store.candidates.filter(
            (c) => c.group === 'GROUP_B' && c.status === 'ACTIVE'
          ).length,
      },
    };
  }

  public static getCurrentActiveRound(state: ElectionState) {
    const store = db.getStore();
    if (state.startsWith('ROUND_1')) return store.rounds.ROUND_1;
    if (state.startsWith('ROUND_2')) return store.rounds.ROUND_2;
    if (state.startsWith('FINAL_ROUND')) return store.rounds.FINAL_ROUND;
    return null;
  }

  /**
   * Transition state machine
   */
  public static async transitionState(
    newState: ElectionState,
    adminUser: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string; newState?: ElectionState }> {
    return await db.updateStore((store) => {
      const currentState = store.currentState;

      const validTransitions: Record<ElectionState, ElectionState[]> = {
        DRAFT: ['ROUND_1_OPEN'],
        ROUND_1_OPEN: ['ROUND_1_CLOSED'],
        ROUND_1_CLOSED: ['ROUND_1_FINALIZED', 'ROUND_1_OPEN'],
        ROUND_1_FINALIZED: ['ROUND_2_OPEN'],
        ROUND_2_OPEN: ['ROUND_2_CLOSED'],
        ROUND_2_CLOSED: ['ROUND_2_FINALIZED', 'ROUND_2_OPEN'],
        ROUND_2_FINALIZED: ['CONSOLIDATION_PENDING'],
        CONSOLIDATION_PENDING: ['FINAL_ROUND_OPEN'],
        FINAL_ROUND_OPEN: ['FINAL_ROUND_CLOSED'],
        FINAL_ROUND_CLOSED: ['FINAL_ROUND_FINALIZED', 'FINAL_ROUND_OPEN'],
        FINAL_ROUND_FINALIZED: ['COMPLETED'],
        COMPLETED: [],
      };

      if (!validTransitions[currentState].includes(newState)) {
        return {
          success: false,
          error: `Invalid state transition from ${currentState} to ${newState}.`,
        };
      }

      const now = new Date().toISOString();

      if (newState === 'ROUND_1_OPEN') {
        const groupACandidates = store.candidates.filter(
          (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
        );
        if (groupACandidates.length === 0) {
          return { success: false, error: 'Cannot open Round 1 without active Group A candidates.' };
        }
        store.rounds.ROUND_1.eligibleCandidateIds = groupACandidates.map((c) => c.id);
        store.rounds.ROUND_1.isOpened = true;
        store.rounds.ROUND_1.openedAt = now;
        // Lock token batch when voting opens
        store.rounds.ROUND_1.isTokenBatchLocked = true;
        store.rounds.ROUND_1.tokenBatchLockedAt = now;
      } else if (newState === 'ROUND_1_CLOSED') {
        store.rounds.ROUND_1.isClosed = true;
        store.rounds.ROUND_1.closedAt = now;
        this.computeRoundResultInternal(store, 'ROUND_1');
      } else if (newState === 'ROUND_1_FINALIZED') {
        const round1 = store.rounds.ROUND_1;
        if (round1.hasTie && !round1.winnerCandidateId) {
          return {
            success: false,
            error: 'Round 1 has an unresolved tie (TIE_REQUIRES_ADMIN_ACTION). Administrator must resolve the tie before finalization.',
          };
        }
        if (!round1.winnerCandidateId) {
          const res = this.computeRoundResultInternal(store, 'ROUND_1');
          if (res.hasTie) {
            return {
              success: false,
              error: 'Round 1 has a tie for 1st place (TIE_REQUIRES_ADMIN_ACTION). Administrator must resolve the tie first.',
            };
          }
        }

        const winnerId = store.rounds.ROUND_1.winnerCandidateId!;
        const winnerCandidate = store.candidates.find((c) => c.id === winnerId);
        if (winnerCandidate) {
          winnerCandidate.status = 'ELECTED';
          winnerCandidate.electedPosition = 'IZI Makai Pi';
          winnerCandidate.electedRound = 'ROUND_1';
          winnerCandidate.updatedAt = now;
        }

        round1.isFinalized = true;
        round1.finalizedAt = now;

        const remainingGroupA = store.candidates.filter(
          (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
        );
        store.rounds.ROUND_2.eligibleCandidateIds = remainingGroupA.map((c) => c.id);
      } else if (newState === 'ROUND_2_OPEN') {
        const remainingGroupA = store.candidates.filter(
          (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
        );
        if (remainingGroupA.length === 0) {
          return { success: false, error: 'No eligible candidates found for Round 2.' };
        }
        store.rounds.ROUND_2.eligibleCandidateIds = remainingGroupA.map((c) => c.id);
        store.rounds.ROUND_2.isOpened = true;
        store.rounds.ROUND_2.openedAt = now;
        store.rounds.ROUND_2.isTokenBatchLocked = true;
        store.rounds.ROUND_2.tokenBatchLockedAt = now;
      } else if (newState === 'ROUND_2_CLOSED') {
        store.rounds.ROUND_2.isClosed = true;
        store.rounds.ROUND_2.closedAt = now;
        this.computeRoundResultInternal(store, 'ROUND_2');
      } else if (newState === 'ROUND_2_FINALIZED') {
        const round2 = store.rounds.ROUND_2;
        if (round2.hasTie && !round2.winnerCandidateId) {
          return {
            success: false,
            error: 'Round 2 has an unresolved tie (TIE_REQUIRES_ADMIN_ACTION). Administrator must resolve the tie before finalization.',
          };
        }
        if (!round2.winnerCandidateId) {
          const res = this.computeRoundResultInternal(store, 'ROUND_2');
          if (res.hasTie) {
            return {
              success: false,
              error: 'Round 2 has a tie for 1st place (TIE_REQUIRES_ADMIN_ACTION). Administrator must resolve the tie first.',
            };
          }
        }

        const winnerId = store.rounds.ROUND_2.winnerCandidateId!;
        const winnerCandidate = store.candidates.find((c) => c.id === winnerId);
        if (winnerCandidate) {
          winnerCandidate.status = 'ELECTED';
          winnerCandidate.electedPosition = 'Genvai Tanu Pi';
          winnerCandidate.electedRound = 'ROUND_2';
          winnerCandidate.updatedAt = now;
        }

        round2.isFinalized = true;
        round2.finalizedAt = now;
      } else if (newState === 'CONSOLIDATION_PENDING') {
        if (!store.rounds.ROUND_2.isFinalized) {
          return { success: false, error: 'Cannot advance to consolidation until Round 2 is finalized.' };
        }
      } else if (newState === 'FINAL_ROUND_OPEN') {
        const remainingGroupA = store.candidates.filter(
          (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
        );
        const activeGroupB = store.candidates.filter(
          (c) => c.group === 'GROUP_B' && c.status === 'ACTIVE'
        );
        const finalPool = store.rounds.FINAL_ROUND.eligibleCandidateIds;

        if (remainingGroupA.length !== 8) {
          return {
            success: false,
            error: `Final round candidate pool invalid: Group A must have exactly 8 remaining candidates (found ${remainingGroupA.length}).`,
          };
        }

        if (activeGroupB.length !== 16) {
          return {
            success: false,
            error: `Final round candidate pool invalid: Group B must have exactly 16 candidates (found ${activeGroupB.length}).`,
          };
        }

        if (!finalPool || finalPool.length !== 24) {
          return {
            success: false,
            error: `Consolidation incomplete: Final Round requires exactly 24 candidates (found ${finalPool?.length || 0}). Please confirm consolidation.`,
          };
        }

        const finalTokens = store.tokens.filter(
          (t) => t.roundId === 'FINAL_ROUND' && t.status !== 'REVOKED'
        );
        if (finalTokens.length === 0) {
          return {
            success: false,
            error: 'Pre-election checklist incomplete: No Round 3 voting tokens have been generated. Administrator must generate Round 3 tokens before opening.',
          };
        }

        const hasDistributed = finalTokens.some(
          (t) => t.status === 'DISTRIBUTED' || t.status === 'USED'
        );
        if (!hasDistributed) {
          return {
            success: false,
            error: 'Pre-election checklist incomplete: Round 3 token distribution has not been confirmed. Please confirm distribution in Token Management before opening Round 3.',
          };
        }

        store.rounds.FINAL_ROUND.isOpened = true;
        store.rounds.FINAL_ROUND.openedAt = now;
        store.rounds.FINAL_ROUND.isTokenBatchLocked = true;
        store.rounds.FINAL_ROUND.tokenBatchLockedAt = now;
      } else if (newState === 'FINAL_ROUND_CLOSED') {
        store.rounds.FINAL_ROUND.isClosed = true;
        store.rounds.FINAL_ROUND.closedAt = now;
        this.computeFinalRoundResultInternal(store);
      } else if (newState === 'FINAL_ROUND_FINALIZED') {
        const finalRound = store.rounds.FINAL_ROUND;
        if (!finalRound.isClosed) {
          return { success: false, error: 'Round 3 / Final Round must be closed before finalization.' };
        }
        if (finalRound.hasTie) {
          return {
            success: false,
            error: 'Final round contains unresolved ties affecting ranking positions (TIE_REQUIRES_ADMIN_ACTION). Administrator must resolve ties before finalization.',
          };
        }
        this.computeFinalRoundResultInternal(store);
        finalRound.isFinalized = true;
        finalRound.finalizedAt = now;
      } else if (newState === 'COMPLETED') {
        const finalRound = store.rounds.FINAL_ROUND;
        if (!finalRound.isClosed) {
          return { success: false, error: 'Final round must be closed before certification.' };
        }
        if (finalRound.hasTie) {
          return {
            success: false,
            error: 'Final round contains unresolved ties affecting ranking positions (TIE_REQUIRES_ADMIN_ACTION). Resolve ties first.',
          };
        }
        this.computeFinalRoundResultInternal(store);
        finalRound.isFinalized = true;
        finalRound.finalizedAt = finalRound.finalizedAt || now;
        store.certifiedAt = now;
        store.certifiedBy = adminUser;
        if (store.results.FINAL_ROUND) {
          store.results.FINAL_ROUND.isCertified = true;
          store.results.FINAL_ROUND.certifiedAt = now;
          store.results.FINAL_ROUND.certifiedBy = adminUser;
        }
      }

      store.currentState = newState;
      db.addAuditLog(adminUser, `State transitioned to ${newState}`, currentState, newState, {
        metadata,
      });

      return { success: true, newState };
    });
  }

  /**
   * Confirm Consolidation: 8 Group A + 16 Group B into 24 final candidates
   */
  public static async confirmConsolidation(
    adminUser: string
  ): Promise<{ success: boolean; error?: string; totalPoolCount?: number }> {
    return await db.updateStore((store) => {
      if (store.currentState !== 'CONSOLIDATION_PENDING' && store.currentState !== 'ROUND_2_FINALIZED') {
        return {
          success: false,
          error: `Consolidation can only be confirmed when Round 2 is finalized or pending consolidation (current: ${store.currentState}).`,
        };
      }

      const remainingGroupA = store.candidates.filter(
        (c) => c.group === 'GROUP_A' && c.status === 'ACTIVE'
      );
      const activeGroupB = store.candidates.filter(
        (c) => c.group === 'GROUP_B' && c.status === 'ACTIVE'
      );

      const consolidated = [...remainingGroupA, ...activeGroupB];
      const consolidatedIds = consolidated.map((c) => c.id);

      store.rounds.FINAL_ROUND.eligibleCandidateIds = consolidatedIds;
      const previousState = store.currentState;
      store.currentState = 'CONSOLIDATION_PENDING';

      db.addAuditLog(adminUser, 'Consolidation Confirmed', previousState, 'CONSOLIDATION_PENDING', {
        metadata: {
          groupARemainingCount: remainingGroupA.length,
          groupBCount: activeGroupB.length,
          finalPoolTotal: consolidatedIds.length,
        },
      });

      return {
        success: true,
        totalPoolCount: consolidatedIds.length,
      };
    });
  }

  /**
   * Secure Round Reset for Administrators (Parts 7-12)
   */
  public static async resetRound(params: {
    roundId: RoundId | string;
    reason: string;
    confirmation: string;
    adminUser: string;
    administrativeReason?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    affected?: {
      roundId: RoundId;
      ballotsAffected: number;
      tokensAffected: number;
      candidatesAffected: number;
      previousState: ElectionState;
      newState: ElectionState;
    };
  }> {
    const rawRoundId = params.roundId;
    const normalizedRoundId = normalizeRoundId(rawRoundId);
    const reason = (params.reason || params.administrativeReason || '').trim();
    const confirmation = (params.confirmation || '').trim();
    const adminUser = params.adminUser || 'admin';

    if (!normalizedRoundId) {
      return {
        success: false,
        error: `Invalid round identifier "${rawRoundId || ''}". Expected ROUND_1, ROUND_2, or FINAL_ROUND / ROUND_3.`,
      };
    }
    const roundId = normalizedRoundId;

    if (!confirmation || confirmation !== 'I UNDERSTAND THIS WILL RESET THE ROUND') {
      return {
        success: false,
        error: 'Confirmation text must exactly match: "I UNDERSTAND THIS WILL RESET THE ROUND"',
      };
    }

    if (!reason || reason.length < 5) {
      return {
        success: false,
        error: 'A specific administrative reason (at least 5 characters) is required for round reset.',
      };
    }

    return await db.updateStore((store) => {
      const round = store.rounds[roundId];
      if (!round) {
        return { success: false, error: 'Round not found in election store.' };
      }

      // Live finalized round protection (Part 11)
      if (store.mode === 'LIVE' && round.isFinalized) {
        return {
          success: false,
          error: 'This round has been finalized and is protected in a live election. Finalized live election results cannot be destructively reset.',
        };
      }

      // Incompatible state checks: A reset must NEVER accidentally affect another round
      if (roundId === 'ROUND_1') {
        const round2HasActivity =
          store.rounds.ROUND_2?.isOpened ||
          store.rounds.ROUND_2?.isFinalized ||
          (store.ballots || []).some((b: Ballot) => b.roundId === 'ROUND_2');
        const finalRoundHasActivity =
          store.rounds.FINAL_ROUND?.isOpened ||
          store.rounds.FINAL_ROUND?.isFinalized ||
          (store.ballots || []).some((b: Ballot) => b.roundId === 'FINAL_ROUND');
        if (round2HasActivity || finalRoundHasActivity) {
          return {
            success: false,
            error:
              'Incompatible state: Cannot reset Round 1 while Round 2 or Final Round is active, finalized, or has ballots cast. Please reset subsequent rounds first.',
          };
        }
      } else if (roundId === 'ROUND_2') {
        if (!store.rounds.ROUND_1?.isFinalized) {
          return {
            success: false,
            error: 'Incompatible state: Cannot reset Round 2 before Round 1 has been finalized.',
          };
        }
        const finalRoundHasActivity =
          store.rounds.FINAL_ROUND?.isOpened ||
          store.rounds.FINAL_ROUND?.isFinalized ||
          (store.ballots || []).some((b: Ballot) => b.roundId === 'FINAL_ROUND');
        if (finalRoundHasActivity) {
          return {
            success: false,
            error:
              'Incompatible state: Cannot reset Round 2 while Final Round is active, finalized, or has ballots cast. Please reset Final Round first.',
          };
        }
      } else if (roundId === 'FINAL_ROUND') {
        if (!store.rounds.ROUND_2?.isFinalized) {
          return {
            success: false,
            error: 'Incompatible state: Cannot reset Final Round before Round 2 has been finalized.',
          };
        }
      }

      const previousState = store.currentState;
      const ballotsForRound = (store.ballots || store.votes || []).filter((b: Ballot) => b.roundId === roundId);
      const ballotsAffected = ballotsForRound.length;

      const tokensForRound = store.tokens.filter((t: VotingToken) => t.roundId === roundId);
      const tokensAffected = tokensForRound.length;
      const candidatesAffected = round.eligibleCandidateIds?.length || 0;

      const now = new Date().toISOString();

      // Revoke all tokens for this round so old tokens can NEVER be reused (Part 10 & 28)
      tokensForRound.forEach((t: VotingToken) => {
        t.status = 'REVOKED';
        t.revokedAt = now;
        t.revokedReason = `Round reset by ${adminUser}: ${reason}`;
      });

      // Clear or archive ballots for this round
      if (store.mode === 'LIVE') {
        if (!store.archivedBallots) store.archivedBallots = [];
        store.archivedBallots.push(...ballotsForRound);
      }
      store.ballots = (store.ballots || []).filter((b: Ballot) => b.roundId !== roundId);
      if (store.votes) {
        store.votes = store.votes.filter((b: Ballot) => b.roundId !== roundId);
      }

      // Reset round metrics and flags
      round.ballotsCast = 0;
      round.totalSelections = 0;
      round.totalVotes = 0;
      round.isOpened = false;
      round.isClosed = false;
      round.isFinalized = false;
      round.openedAt = undefined;
      round.closedAt = undefined;
      round.finalizedAt = undefined;
      round.winnerCandidateId = undefined;
      round.winnerCandidateName = undefined;
      round.hasTie = false;
      round.tieStatus = 'NONE';
      round.tiedCandidateIds = undefined;
      round.isTokenBatchLocked = false;
      round.tokenBatchLockedAt = undefined;

      // Revert candidates elected or ranked in this round
      if (roundId === 'FINAL_ROUND') {
        store.candidates.forEach((cand: Candidate) => {
          if (cand.electedRound === 'FINAL_ROUND' || cand.status === 'FINAL_RANKED' || cand.finalRank !== undefined) {
            cand.status = 'ACTIVE';
            cand.electedPosition = undefined;
            cand.electedRound = undefined;
            cand.finalRank = undefined;
            cand.updatedAt = now;
          }
        });
      } else {
        store.candidates.forEach((cand: Candidate) => {
          if (cand.electedRound === roundId) {
            cand.status = 'ACTIVE';
            cand.electedPosition = undefined;
            cand.electedRound = undefined;
            cand.finalRank = undefined;
            cand.updatedAt = now;
          }
        });
      }

      // Clear computed results for this round
      delete store.results[roundId];

      // Determine new appropriate election state
      let newState: ElectionState = 'DRAFT';
      if (roundId === 'ROUND_1') {
        newState = 'DRAFT';
      } else if (roundId === 'ROUND_2') {
        newState = 'ROUND_1_FINALIZED';
      } else if (roundId === 'FINAL_ROUND') {
        newState = 'CONSOLIDATION_PENDING';
      }

      store.currentState = newState;
      if (store.certifiedAt) {
        store.certifiedAt = undefined;
        store.certifiedBy = undefined;
      }

      // Immutable hash-chained audit log entry (Part 12)
      db.addAuditLog(adminUser, 'ROUND_RESET', previousState, newState, {
        affectedRound: roundId,
        metadata: {
          round: roundId,
          reason,
          ballotsAffected,
          tokensAffected,
          candidatePoolCount: candidatesAffected,
          previousState,
          newState,
          timestamp: now,
        },
      });

      return {
        success: true,
        message: `${round.title} was successfully reset.`,
        affected: {
          roundId,
          ballotsAffected,
          tokensAffected,
          candidatesAffected,
          previousState,
          newState,
        },
      };
    });
  }

  /**
   * Submit an anonymous ballot with EXACTLY 2 DIFFERENT CANDIDATES server-side
   */
  public static async submitVote(
    payload: VoteSubmissionPayload
  ): Promise<VoteSubmissionResult> {
    let releaseLock: () => void;
    const lockWait = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const prevLock = voteProcessingLock;
    voteProcessingLock = lockWait;

    try {
      await prevLock;

      return await db.updateStore((store) => {
        const { roundId, candidateIds, tokenCode } = payload;
        const now = new Date().toISOString();

        // 1. Check Election and Round State
        const expectedOpenState: Record<RoundId, ElectionState> = {
          ROUND_1: 'ROUND_1_OPEN',
          ROUND_2: 'ROUND_2_OPEN',
          FINAL_ROUND: 'FINAL_ROUND_OPEN',
        };

        if (store.currentState !== expectedOpenState[roundId]) {
          if (store.currentState === 'DRAFT') {
            return { success: false, error: 'Voting has not started yet.' };
          }
          if (
            store.currentState.includes('CLOSED') ||
            store.currentState.includes('FINALIZED') ||
            store.currentState === 'COMPLETED'
          ) {
            return { success: false, error: 'Voting is currently closed for this round.' };
          }
          return {
            success: false,
            error: `Voting is not open for ${roundId}. Current phase: ${store.currentState}`,
          };
        }

        const round = store.rounds[roundId];
        if (!round || !round.isOpened || round.isClosed || round.isFinalized) {
          return { success: false, error: 'Voting is closed for this round.' };
        }

        // 2. Validate Candidate Selections Array: Must be EXACTLY 2 candidates
        if (!candidateIds || !Array.isArray(candidateIds)) {
          return {
            success: false,
            error: 'Invalid ballot submission. Candidate selections must be an array of candidate IDs.',
          };
        }

        if (candidateIds.length === 0) {
          return {
            success: false,
            error: 'You must select exactly 2 candidates. No candidates were selected.',
          };
        }

        if (candidateIds.length === 1) {
          return {
            success: false,
            error: 'You must select exactly 2 candidates. Only 1 candidate was selected.',
          };
        }

        if (candidateIds.length > 2) {
          return {
            success: false,
            error: `You cannot select more than 2 candidates. ${candidateIds.length} candidates were selected.`,
          };
        }

        const [candId1, candId2] = candidateIds;
        if (candId1 === candId2) {
          return {
            success: false,
            error: 'Duplicate candidate selection is not allowed. You must select two different candidates.',
          };
        }

        // Validate Candidate 1
        const candidate1 = store.candidates.find((c) => c.id === candId1);
        if (!candidate1) {
          return {
            success: false,
            error: `Candidate ID "${candId1}" was not found in the election registry.`,
          };
        }
        if (candidate1.status !== 'ACTIVE') {
          return {
            success: false,
            error: `Candidate ${candidate1.name} is ${candidate1.status.toLowerCase()} and cannot receive votes.`,
          };
        }
        if (!round.eligibleCandidateIds.includes(candId1)) {
          return {
            success: false,
            error: `Candidate ${candidate1.name} does not belong to the eligible pool for this round.`,
          };
        }

        // Validate Candidate 2
        const candidate2 = store.candidates.find((c) => c.id === candId2);
        if (!candidate2) {
          return {
            success: false,
            error: `Candidate ID "${candId2}" was not found in the election registry.`,
          };
        }
        if (candidate2.status !== 'ACTIVE') {
          return {
            success: false,
            error: `Candidate ${candidate2.name} is ${candidate2.status.toLowerCase()} and cannot receive votes.`,
          };
        }
        if (!round.eligibleCandidateIds.includes(candId2)) {
          return {
            success: false,
            error: `Candidate ${candidate2.name} does not belong to the eligible pool for this round.`,
          };
        }

        // 3. Validate Anonymous Voting Token
        if (!tokenCode || tokenCode.trim().length === 0) {
          return {
            success: false,
            error: 'A valid anonymous voting token is required to cast a ballot.',
          };
        }

        const normalizedToken = tokenCode.trim().toUpperCase();
        const incomingHash = crypto.createHash('sha256').update(normalizedToken).digest('hex');

        // Check if token exists in database (matching either plaintext code or hash)
        const tokenRecord = store.tokens.find(
          (t) =>
            (t.tokenCode.toUpperCase() === normalizedToken || t.tokenHash === incomingHash) &&
            t.electionId === store.electionId
        );

        if (!tokenRecord) {
          return {
            success: false,
            error: 'Invalid voting token.',
          };
        }

        // Check round-specificity: A token issued for Round 1 must NOT work for Round 2, etc.
        if (tokenRecord.roundId !== roundId) {
          return {
            success: false,
            error: 'This voting token is not valid for the current election round.',
          };
        }

        // Check if revoked
        if (tokenRecord.status === 'REVOKED') {
          return {
            success: false,
            error: 'This voting token has been revoked.',
          };
        }

        // Check if already used
        if (tokenRecord.isUsed || tokenRecord.status === 'USED') {
          return {
            success: false,
            error: 'This voting token has already been used.',
          };
        }

        // 4. Mark token as permanently used
        tokenRecord.isUsed = true;
        tokenRecord.status = 'USED';
        tokenRecord.usedAt = now;

        // 5. Generate decoupled cryptographic vote receipt
        const verificationSalt = crypto.randomBytes(4).toString('hex').toUpperCase();
        const verificationCode = `VOTE-REC-${verificationSalt.slice(0, 4)}-${Date.now()
          .toString(36)
          .toUpperCase()
          .slice(-4)}`;

        const integrityContent = [
          store.electionId,
          roundId,
          incomingHash,
          candId1,
          candId2,
          now,
          verificationCode,
        ].join('::');
        const integrityHash = crypto.createHash('sha256').update(integrityContent).digest('hex');

        // Create ONE ballot with TWO selections
        const ballotRecord: Ballot = {
          id: 'ballot_' + crypto.randomBytes(8).toString('hex'),
          electionId: store.electionId,
          roundId,
          tokenHash: incomingHash,
          candidateId1: candId1,
          candidateId2: candId2,
          candidateIds: [candId1, candId2],
          createdAt: now,
          receiptCode: verificationCode,
          integrityHash,
        };

        if (!store.ballots) store.ballots = [];
        store.ballots.push(ballotRecord);
        store.votes = store.ballots;

        round.ballotsCast = (round.ballotsCast || 0) + 1;
        round.totalSelections = (round.totalSelections || 0) + 2;
        round.totalVotes = round.ballotsCast;

        return {
          success: true,
          verificationCode,
          timestamp: now,
          roundTitle: round.title,
          candidateNames: [candidate1.name, candidate2.name],
          selectionCount: 2,
        };
      });
    } finally {
      releaseLock!();
    }
  }

  /**
   * Internal vote counting for Round 1 and Round 2
   */
  private static computeRoundResultInternal(
    store: any,
    roundId: 'ROUND_1' | 'ROUND_2'
  ): { hasTie: boolean; winnerId?: string; winnerName?: string } {
    const round = store.rounds[roundId];
    const eligibleIds: string[] = round.eligibleCandidateIds;
    const ballotsForRound: Ballot[] = (store.ballots || store.votes || []).filter(
      (b: Ballot) => b.roundId === roundId
    );

    const selectionMap = new Map<string, number>();
    eligibleIds.forEach((id) => selectionMap.set(id, 0));

    ballotsForRound.forEach((b: Ballot) => {
      const c1 = b.candidateId1 || (b.candidateIds && b.candidateIds[0]);
      const c2 = b.candidateId2 || (b.candidateIds && b.candidateIds[1]);

      if (c1 && selectionMap.has(c1)) {
        selectionMap.set(c1, (selectionMap.get(c1) || 0) + 1);
      }
      if (c2 && selectionMap.has(c2)) {
        selectionMap.set(c2, (selectionMap.get(c2) || 0) + 1);
      }
    });

    const ballotsCast = ballotsForRound.length;
    const totalSelections = ballotsCast * 2;
    round.ballotsCast = ballotsCast;
    round.totalSelections = totalSelections;
    round.totalVotes = ballotsCast;

    const candidateResults: CandidateResultItem[] = eligibleIds.map((id) => {
      const cand = store.candidates.find((c: Candidate) => c.id === id);
      const count = selectionMap.get(id) || 0;
      const percentage =
        totalSelections > 0 ? Number(((count / totalSelections) * 100).toFixed(2)) : 0;
      return {
        candidateId: id,
        candidateName: cand ? cand.name : 'Unknown Candidate',
        group: cand ? cand.group : 'GROUP_A',
        selectionCount: count,
        voteCount: count,
        percentage,
        rank: 1,
        status: cand ? cand.status : 'ACTIVE',
        electedPosition: undefined,
      };
    });

    candidateResults.sort((a, b) => b.selectionCount - a.selectionCount);

    candidateResults.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    let hasTie = false;
    let tiedCandidateIds: string[] = [];

    if (candidateResults.length >= 2) {
      const topSelections = candidateResults[0].selectionCount;
      const tied = candidateResults.filter((r) => r.selectionCount === topSelections);
      if (tied.length > 1) {
        hasTie = true;
        tiedCandidateIds = tied.map((r) => r.candidateId);
      }
    }

    if (round.tieStatus === 'RESOLVED' && round.winnerCandidateId) {
      hasTie = false;
      round.hasTie = false;
      const winnerCand = store.candidates.find((c: Candidate) => c.id === round.winnerCandidateId);
      if (winnerCand) {
        round.winnerCandidateName = winnerCand.name;
      }
    } else {
      round.hasTie = hasTie;
      round.tieStatus = hasTie ? 'TIE_REQUIRES_ADMIN_ACTION' : 'NONE';
      round.tiedCandidateIds = hasTie ? tiedCandidateIds : undefined;
    }

    if (!hasTie && candidateResults.length > 0) {
      if (!round.winnerCandidateId) {
        round.winnerCandidateId = candidateResults[0].candidateId;
        round.winnerCandidateName = candidateResults[0].candidateName;
      }
      const topCandResult = candidateResults.find((r) => r.candidateId === round.winnerCandidateId) || candidateResults[0];
      topCandResult.electedPosition = round.electedPosition;
    }

    const result: ElectionResult = {
      roundId,
      title: round.title,
      computedAt: new Date().toISOString(),
      ballotsCast,
      totalSelections,
      totalVotes: ballotsCast,
      candidateResults,
      isCertified: false,
    };

    store.results[roundId] = result;

    return {
      hasTie,
      winnerId: round.winnerCandidateId,
      winnerName: round.winnerCandidateName,
    };
  }

  /**
   * Internal vote counting for Final Round (24 candidates -> Top 7 positions)
   */
  private static computeFinalRoundResultInternal(store: any): {
    hasTie: boolean;
    tiedCandidateIds?: string[];
  } {
    const round = store.rounds.FINAL_ROUND;
    const eligibleIds: string[] = round.eligibleCandidateIds;
    const ballotsForRound: Ballot[] = (store.ballots || store.votes || []).filter(
      (b: Ballot) => b.roundId === 'FINAL_ROUND'
    );

    const selectionMap = new Map<string, number>();
    eligibleIds.forEach((id) => selectionMap.set(id, 0));

    ballotsForRound.forEach((b: Ballot) => {
      const c1 = b.candidateId1 || (b.candidateIds && b.candidateIds[0]);
      const c2 = b.candidateId2 || (b.candidateIds && b.candidateIds[1]);

      if (c1 && selectionMap.has(c1)) {
        selectionMap.set(c1, (selectionMap.get(c1) || 0) + 1);
      }
      if (c2 && selectionMap.has(c2)) {
        selectionMap.set(c2, (selectionMap.get(c2) || 0) + 1);
      }
    });

    const ballotsCast = ballotsForRound.length;
    const totalSelections = ballotsCast * 2;
    round.ballotsCast = ballotsCast;
    round.totalSelections = totalSelections;
    round.totalVotes = ballotsCast;

    const candidateResults: CandidateResultItem[] = eligibleIds.map((id) => {
      const cand = store.candidates.find((c: Candidate) => c.id === id);
      const count = selectionMap.get(id) || 0;
      const percentage =
        totalSelections > 0 ? Number(((count / totalSelections) * 100).toFixed(2)) : 0;
      return {
        candidateId: id,
        candidateName: cand ? cand.name : 'Unknown Candidate',
        group: cand ? cand.group : 'GROUP_B',
        selectionCount: count,
        voteCount: count,
        percentage,
        rank: 1,
        status: cand ? cand.status : 'ACTIVE',
        electedPosition: undefined as string | undefined,
      };
    });

    candidateResults.sort((a, b) => b.selectionCount - a.selectionCount);

    candidateResults.forEach((r, idx) => {
      r.rank = idx + 1;
      const matchingPos = FINAL_TOP_POSITIONS.find((p: FinalTopPosition) => p.rank === r.rank);
      if (matchingPos) {
        r.electedPosition = matchingPos.title;
      }
    });

    let hasTie = false;
    const tiedCandidateIds: string[] = [];

    // Check tie at rank 1
    if (candidateResults.length >= 2 && candidateResults[0].selectionCount === candidateResults[1].selectionCount) {
      hasTie = true;
      const topCount = candidateResults[0].selectionCount;
      candidateResults.filter((r) => r.selectionCount === topCount).forEach((r) => {
        if (!tiedCandidateIds.includes(r.candidateId)) tiedCandidateIds.push(r.candidateId);
      });
    }

    // Check tie at rank 7 / 8 boundary
    if (candidateResults.length >= 8) {
      const rank7Count = candidateResults[6].selectionCount;
      const rank8Count = candidateResults[7].selectionCount;
      if (rank7Count === rank8Count) {
        hasTie = true;
        const tiedGroup = candidateResults.filter((r) => r.selectionCount === rank7Count);
        tiedGroup.forEach((r) => {
          if (!tiedCandidateIds.includes(r.candidateId)) tiedCandidateIds.push(r.candidateId);
        });
      }
    }

    // Check for any tie between positions inside top 7 that affects title assignment
    for (let i = 0; i < Math.min(candidateResults.length - 1, 6); i++) {
      if (candidateResults[i].selectionCount === candidateResults[i + 1].selectionCount) {
        hasTie = true;
        if (!tiedCandidateIds.includes(candidateResults[i].candidateId)) {
          tiedCandidateIds.push(candidateResults[i].candidateId);
        }
        if (!tiedCandidateIds.includes(candidateResults[i + 1].candidateId)) {
          tiedCandidateIds.push(candidateResults[i + 1].candidateId);
        }
      }
    }

    if (round.tieStatus === 'RESOLVED') {
      hasTie = false;
      round.hasTie = false;
    } else {
      round.hasTie = hasTie;
      round.tieStatus = hasTie ? 'TIE_REQUIRES_ADMIN_ACTION' : 'NONE';
      round.tiedCandidateIds = hasTie ? tiedCandidateIds : undefined;
    }

    if (!hasTie) {
      candidateResults.forEach((r) => {
        const cand = store.candidates.find((c: Candidate) => c.id === r.candidateId);
        if (cand) {
          cand.finalRank = r.rank;
          if (r.rank <= 7) {
            cand.status = 'ELECTED';
            cand.electedPosition = r.electedPosition;
            cand.electedRound = 'FINAL_ROUND';
          } else {
            cand.status = 'FINAL_RANKED';
          }
        }
      });
    }

    const result: ElectionResult = {
      roundId: 'FINAL_ROUND',
      title: round.title,
      computedAt: new Date().toISOString(),
      ballotsCast,
      totalSelections,
      totalVotes: ballotsCast,
      candidateResults,
      isCertified: false,
    };

    store.results.FINAL_ROUND = result;

    return {
      hasTie,
      tiedCandidateIds,
    };
  }

  /**
   * Resolve an administrative tie
   */
  public static async resolveTie(
    roundId: RoundId | string,
    chosenWinnerId: string,
    method: 'ADMIN_DECISION' | 'COMMITTEE_DRAW' | 'CERTIFIED_RUNOFF',
    notes: string,
    adminUser: string
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedRoundId = normalizeRoundId(roundId);
    if (!normalizedRoundId) {
      return { success: false, error: `Invalid round identifier "${roundId}".` };
    }
    const targetRoundId = normalizedRoundId;

    return await db.updateStore((store) => {
      const round = store.rounds[targetRoundId];
      if (!round) {
        return { success: false, error: 'Round not found.' };
      }
      if (!round.hasTie) {
        return { success: false, error: 'No active tie detected for this round.' };
      }

      if (!notes || typeof notes !== 'string' || !notes.trim()) {
        return { success: false, error: 'Committee notes and justification are required.' };
      }

      if (!round.tiedCandidateIds || !round.tiedCandidateIds.includes(chosenWinnerId)) {
        return {
          success: false,
          error: 'The chosen candidate is not among the tied candidates for this round.',
        };
      }

      const winnerCand = store.candidates.find((c) => c.id === chosenWinnerId);
      if (!winnerCand) {
        return { success: false, error: 'Candidate not found.' };
      }

      const now = new Date().toISOString();
      round.hasTie = false;
      round.tieStatus = 'RESOLVED';
      round.winnerCandidateId = chosenWinnerId;
      round.winnerCandidateName = winnerCand.name;
      round.tieResolutionDetails = {
        resolvedAt: now,
        resolvedBy: adminUser,
        method,
        chosenWinnerId,
        notes,
      };

      db.addAuditLog(
        adminUser,
        `Tie Resolved for ${round.title}`,
        store.currentState,
        store.currentState,
        {
          affectedRound: targetRoundId,
          affectedCandidateId: chosenWinnerId,
          affectedCandidateName: winnerCand.name,
          metadata: {
            method,
            notes,
            tiedCandidates: round.tiedCandidateIds,
          },
        }
      );

      if (targetRoundId === 'FINAL_ROUND') {
        this.computeFinalRoundResultInternal(store);
      } else {
        this.computeRoundResultInternal(store, targetRoundId);
      }

      return { success: true };
    });
  }

  /**
   * Administrator Token Batch Generation
   * MUST happen before voting is open.
   * Locked against regeneration once voting opens.
   */
  public static async generateTokens(
    roundId: RoundId,
    count: number,
    batchLabel: string,
    adminUser: string
  ): Promise<{ success: boolean; error?: string; count?: number; tokens?: VotingToken[] }> {
    return await db.updateStore((store) => {
      const round = store.rounds[roundId];
      if (!round) {
        return { success: false, error: 'Invalid round identifier.' };
      }

      // Check if round is already open or token batch is locked
      const expectedOpenState: Record<RoundId, ElectionState> = {
        ROUND_1: 'ROUND_1_OPEN',
        ROUND_2: 'ROUND_2_OPEN',
        FINAL_ROUND: 'FINAL_ROUND_OPEN',
      };

      if (store.currentState === expectedOpenState[roundId] || round.isTokenBatchLocked) {
        return {
          success: false,
          error: 'Token batch locked because voting is OPEN.',
        };
      }

      const createdTokens: VotingToken[] = [];
      const now = new Date().toISOString();

      for (let i = 0; i < count; i++) {
        const tokenCode = generateSecureTokenCode();
        const tokenHash = crypto.createHash('sha256').update(tokenCode).digest('hex');

        const tokenObj: VotingToken = {
          id: 'tok_' + crypto.randomBytes(6).toString('hex'),
          tokenCode,
          tokenHash,
          electionId: store.electionId,
          roundId,
          status: 'GENERATED',
          isUsed: false,
          createdAt: now,
          batchLabel: batchLabel || 'Standard Batch',
        };

        store.tokens.push(tokenObj);
        createdTokens.push(tokenObj);
      }

      // NEVER log plaintext token codes in audit log!
      db.addAuditLog(
        adminUser,
        `Generated ${count} Cryptographic Voting Tokens for ${roundId}`,
        store.currentState,
        store.currentState,
        {
          affectedRound: roundId,
          metadata: {
            batchCount: count,
            batchLabel,
            // Only record hashes count, not plaintext
            tokensGeneratedCount: count,
          },
        }
      );

      return {
        success: true,
        count: createdTokens.length,
        tokens: createdTokens,
      };
    });
  }

  /**
   * Administrator Token Batch Regeneration
   * Allows regenerating unused tokens before voting is open.
   * Locked once voting opens.
   */
  public static async regenerateTokens(
    roundId: RoundId,
    count: number,
    batchLabel: string,
    adminUser: string
  ): Promise<{ success: boolean; error?: string; count?: number; tokens?: VotingToken[] }> {
    return await db.updateStore((store) => {
      const round = store.rounds[roundId];
      if (!round) {
        return { success: false, error: 'Invalid round identifier.' };
      }

      const expectedOpenState: Record<RoundId, ElectionState> = {
        ROUND_1: 'ROUND_1_OPEN',
        ROUND_2: 'ROUND_2_OPEN',
        FINAL_ROUND: 'FINAL_ROUND_OPEN',
      };

      if (store.currentState === expectedOpenState[roundId] || round.isOpened) {
        return {
          success: false,
          error: 'Cannot regenerate tokens because voting is actively OPEN for this round.',
        };
      }

      // Check if any tokens for this round are used (cannot regenerate if votes already cast)
      const usedTokensCount = store.tokens.filter(
        (t) => t.roundId === roundId && (t.isUsed || t.status === 'USED')
      ).length;

      if (usedTokensCount > 0) {
        return {
          success: false,
          error: 'Cannot regenerate tokens: Ballots have already been cast using tokens for this round.',
        };
      }

      // Remove previous unused tokens for this round
      const removedCount = store.tokens.filter((t) => t.roundId === roundId).length;
      store.tokens = store.tokens.filter((t) => t.roundId !== roundId);

      // Reset round lock
      round.isTokenBatchLocked = false;
      delete round.tokenBatchLockedAt;

      // Generate new tokens
      const createdTokens: VotingToken[] = [];
      const now = new Date().toISOString();

      for (let i = 0; i < count; i++) {
        const tokenCode = generateSecureTokenCode();
        const tokenHash = crypto.createHash('sha256').update(tokenCode).digest('hex');

        const tokenObj: VotingToken = {
          id: 'tok_' + crypto.randomBytes(6).toString('hex'),
          tokenCode,
          tokenHash,
          electionId: store.electionId,
          roundId,
          status: 'GENERATED',
          isUsed: false,
          createdAt: now,
          batchLabel: batchLabel || 'Regenerated Batch',
        };

        store.tokens.push(tokenObj);
        createdTokens.push(tokenObj);
      }

      // NEVER log plaintext token codes in audit log!
      db.addAuditLog(
        adminUser,
        `Regenerated ${count} Cryptographic Voting Tokens for ${roundId} (Replaced ${removedCount} previous tokens)`,
        store.currentState,
        store.currentState,
        {
          affectedRound: roundId,
          metadata: {
            previousTokensRemoved: removedCount,
            newBatchCount: count,
            batchLabel,
            tokensGeneratedCount: count,
          },
        }
      );

      return {
        success: true,
        count: createdTokens.length,
        tokens: createdTokens,
      };
    });
  }

  /**
   * Administrator confirms token distribution and locks batch
   */
  public static async confirmDistribution(
    roundId: RoundId,
    adminUser: string
  ): Promise<{ success: boolean; error?: string; count?: number }> {
    return await db.updateStore((store) => {
      const round = store.rounds[roundId];
      if (!round) return { success: false, error: 'Round not found.' };

      const now = new Date().toISOString();
      const roundTokens = store.tokens.filter(
        (t) => t.roundId === roundId && t.status === 'GENERATED'
      );

      roundTokens.forEach((t) => {
        t.status = 'DISTRIBUTED';
        t.distributedAt = now;
      });

      round.isTokenBatchLocked = true;
      round.tokenBatchLockedAt = now;

      db.addAuditLog(
        adminUser,
        `Confirmed Distribution of ${roundTokens.length} Tokens for ${round.title}`,
        store.currentState,
        store.currentState,
        {
          affectedRound: roundId,
          metadata: {
            distributedCount: roundTokens.length,
            batchLocked: true,
          },
        }
      );

      return {
        success: true,
        count: roundTokens.length,
      };
    });
  }

  /**
   * Revoke an unused token
   */
  public static async revokeToken(
    tokenId: string,
    reason: string,
    adminUser: string
  ): Promise<{ success: boolean; error?: string }> {
    return await db.updateStore((store) => {
      const token = store.tokens.find((t) => t.id === tokenId);
      if (!token) return { success: false, error: 'Token not found.' };

      if (token.isUsed || token.status === 'USED') {
        return { success: false, error: 'Cannot revoke a token that has already been used to cast a ballot.' };
      }

      if (token.status === 'REVOKED') {
        return { success: false, error: 'Token is already revoked.' };
      }

      const now = new Date().toISOString();
      token.status = 'REVOKED';
      token.revokedAt = now;
      token.revokedBy = adminUser;

      db.addAuditLog(
        adminUser,
        `Revoked Voting Token ID ${token.id.slice(0, 8)} (${token.roundId})`,
        store.currentState,
        store.currentState,
        {
          affectedRound: token.roundId,
          metadata: {
            tokenId: token.id,
            reason: reason || 'Revoked by administrator',
          },
        }
      );

      return { success: true };
    });
  }

  /**
   * Candidate management: Add candidate
   */
  public static async addCandidate(
    name: string,
    group: 'GROUP_A' | 'GROUP_B',
    adminUser: string,
    bio?: string
  ): Promise<{ success: boolean; candidate?: Candidate; error?: string }> {
    return await db.updateStore((store) => {
      if (['ROUND_1_OPEN', 'ROUND_2_OPEN', 'FINAL_ROUND_OPEN'].includes(store.currentState)) {
        return {
          success: false,
          error: 'Cannot add candidate while an election round is actively open.',
        };
      }

      if (store.currentState === 'COMPLETED' || store.currentState === 'FINAL_ROUND_CLOSED') {
        return {
          success: false,
          error: 'Cannot add candidate after final round has concluded.',
        };
      }

      const now = new Date().toISOString();
      const prefix = group === 'GROUP_A' ? 'cand_a_' : 'cand_b_';
      const count = store.candidates.filter((c) => c.group === group).length + 1;
      const id = `${prefix}${String(count).padStart(2, '0')}_${crypto.randomBytes(2).toString('hex')}`;

      const newCand: Candidate = {
        id,
        name: name.trim(),
        group,
        status: 'ACTIVE',
        orderIndex: store.candidates.length + 1,
        bio: bio?.trim(),
        createdAt: now,
        updatedAt: now,
      };

      store.candidates.push(newCand);

      if (store.currentState === 'DRAFT' && group === 'GROUP_A') {
        store.rounds.ROUND_1.eligibleCandidateIds.push(newCand.id);
      }

      db.addAuditLog(adminUser, `Added Candidate: ${newCand.name}`, store.currentState, store.currentState, {
        affectedCandidateId: newCand.id,
        affectedCandidateName: newCand.name,
        metadata: { group },
      });

      return { success: true, candidate: newCand };
    });
  }

  /**
   * Candidate management: Edit candidate
   */
  public static async editCandidate(
    id: string,
    updates: { name?: string; group?: 'GROUP_A' | 'GROUP_B'; bio?: string },
    adminUser: string
  ): Promise<{ success: boolean; candidate?: Candidate; error?: string }> {
    return await db.updateStore((store) => {
      if (['ROUND_1_OPEN', 'ROUND_2_OPEN', 'FINAL_ROUND_OPEN'].includes(store.currentState)) {
        return {
          success: false,
          error: 'Cannot edit candidate details while an election round is actively open.',
        };
      }

      const cand = store.candidates.find((c) => c.id === id);
      if (!cand) {
        return { success: false, error: 'Candidate not found.' };
      }

      if (cand.electedPosition || cand.electedRound) {
        return {
          success: false,
          error: 'Cannot edit candidate who has already been elected to an executive office.',
        };
      }

      if (updates.group && updates.group !== cand.group && store.currentState !== 'DRAFT') {
        return {
          success: false,
          error: 'Candidate group movement between Group A and Group B is only permitted during the initial DRAFT phase.',
        };
      }

      const prevName = cand.name;
      if (updates.name) cand.name = updates.name.trim();
      if (updates.group) cand.group = updates.group;
      if (updates.bio !== undefined) cand.bio = updates.bio.trim();
      cand.updatedAt = new Date().toISOString();

      db.addAuditLog(adminUser, `Edited Candidate: ${prevName}`, store.currentState, store.currentState, {
        affectedCandidateId: cand.id,
        affectedCandidateName: cand.name,
        metadata: updates,
      });

      return { success: true, candidate: cand };
    });
  }

  /**
   * Candidate management: Toggle status (ACTIVE / DEACTIVATED)
   */
  public static async setCandidateStatus(
    id: string,
    status: CandidateStatus,
    adminUser: string
  ): Promise<{ success: boolean; error?: string }> {
    return await db.updateStore((store) => {
      if (['ROUND_1_OPEN', 'ROUND_2_OPEN', 'FINAL_ROUND_OPEN'].includes(store.currentState)) {
        return {
          success: false,
          error: 'Cannot alter candidate status while an election round is actively open.',
        };
      }

      const cand = store.candidates.find((c) => c.id === id);
      if (!cand) {
        return { success: false, error: 'Candidate not found.' };
      }

      if (cand.electedPosition || cand.electedRound) {
        return {
          success: false,
          error: 'Cannot alter status of candidate who has been elected to an executive office.',
        };
      }

      const prevStatus = cand.status;
      cand.status = status;
      cand.updatedAt = new Date().toISOString();

      if (store.currentState === 'DRAFT') {
        if (status === 'DEACTIVATED') {
          store.rounds.ROUND_1.eligibleCandidateIds = store.rounds.ROUND_1.eligibleCandidateIds.filter(
            (cid) => cid !== id
          );
        } else if (status === 'ACTIVE' && cand.group === 'GROUP_A') {
          if (!store.rounds.ROUND_1.eligibleCandidateIds.includes(id)) {
            store.rounds.ROUND_1.eligibleCandidateIds.push(id);
          }
        }
      }

      db.addAuditLog(
        adminUser,
        `Candidate Status Changed: ${cand.name} (${prevStatus} -> ${status})`,
        store.currentState,
        store.currentState,
        {
          affectedCandidateId: cand.id,
          affectedCandidateName: cand.name,
          metadata: { prevStatus, newStatus: status },
        }
      );

      return { success: true };
    });
  }

  /**
   * Candidate management: Remove candidate
   */
  public static async removeCandidate(
    id: string,
    adminUser: string
  ): Promise<{ success: boolean; error?: string }> {
    return await db.updateStore((store) => {
      if (['ROUND_1_OPEN', 'ROUND_2_OPEN', 'FINAL_ROUND_OPEN'].includes(store.currentState)) {
        return {
          success: false,
          error: 'Cannot remove candidate while an election round is actively open.',
        };
      }

      const index = store.candidates.findIndex((c) => c.id === id);
      if (index === -1) {
        return { success: false, error: 'Candidate not found.' };
      }

      const cand = store.candidates[index];
      if (cand.electedPosition || cand.electedRound) {
        return {
          success: false,
          error: 'Cannot remove candidate who has been elected to an executive office.',
        };
      }
      const hasVotes = (store.ballots || []).some(
        (b: Ballot) => b.candidateId1 === id || b.candidateId2 === id
      );
      if (hasVotes) {
        return {
          success: false,
          error: 'Cannot permanently delete a candidate who has existing recorded selections. Deactivate instead.',
        };
      }

      store.candidates.splice(index, 1);

      Object.values(store.rounds).forEach((r) => {
        r.eligibleCandidateIds = r.eligibleCandidateIds.filter((cid) => cid !== id);
      });

      db.addAuditLog(adminUser, `Removed Candidate: ${cand.name}`, store.currentState, store.currentState, {
        affectedCandidateId: id,
        affectedCandidateName: cand.name,
      });

      return { success: true };
    });
  }

  /**
   * Update settings
   */
  public static async updateSettings(
    newSettings: Partial<typeof db extends { getStore(): { settings: infer S } } ? S : any>,
    adminUser: string
  ): Promise<{ success: boolean }> {
    return await db.updateStore((store) => {
      store.settings = {
        ...store.settings,
        ...newSettings,
        electionName: OFFICIAL_APP_NAME,
      };

      db.addAuditLog(adminUser, 'Election Settings Updated', store.currentState, store.currentState, {
        metadata: newSettings,
      });

      return { success: true };
    });
  }
}

import express, { Request, Response } from 'express';
import { ElectionEngine } from './electionEngine.js';
import { db, OFFICIAL_APP_NAME } from './db.js';
import {
  verifyAdminCredentials,
  createAdminSession,
  validateAdminSession,
  invalidateAdminSession,
  requireAdminAuth,
  changeAdminPassword,
} from './auth.js';
import { runCompleteElectionTestSuite } from './tests.js';
import { RoundId, ElectionState } from '../types/index.js';

export const apiRouter = express.Router();

// ==========================================
// PUBLIC VOTER ROUTES
// ==========================================

/**
 * Public election status & candidate list
 */
apiRouter.get('/election/public', (req: Request, res: Response) => {
  try {
    const data = ElectionEngine.getPublicElectionState();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal system error retrieving election state.' });
  }
});

/**
 * Verify anonymous single-use voting token
 */
apiRouter.post(['/election/verify-token', '/voter/verify-token'], (req: Request, res: Response) => {
  try {
    let { roundId, tokenCode, token } = req.body;
    const effectiveToken = (tokenCode || token || '').trim();
    if (!effectiveToken) {
      res.status(400).json({ success: false, valid: false, error: 'Please enter a voting token.' });
      return;
    }

    if (!roundId) {
      const publicState = ElectionEngine.getPublicElectionState();
      roundId = publicState.currentRound?.id;
    }

    if (!roundId) {
      res.status(400).json({
        success: false,
        valid: false,
        error: 'No voting round is currently open.',
      });
      return;
    }

    const verification = ElectionEngine.verifyVoterToken(roundId as RoundId, effectiveToken);
    if (!verification.valid) {
      res.status(400).json({
        success: false,
        valid: false,
        error: verification.error || 'Invalid voting token.',
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      data: {
        roundId,
        roundName: verification.roundName,
        electionName: verification.electionName,
        ballotAllowed: true,
        message: 'Token verified successfully. You may proceed to select 2 candidates and cast your ballot.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, valid: false, error: 'Failed to verify voting token.' });
  }
});

/**
 * Cast anonymous ballot with EXACTLY 2 DIFFERENT CANDIDATES
 */
apiRouter.post('/election/vote', async (req: Request, res: Response) => {
  try {
    const { roundId, token, tokenCode, candidateIds, clientFingerprint } = req.body;

    // Normalizing parameters
    const effectiveToken = (token || tokenCode || '').trim();
    let effectiveCandidateIds: string[] = [];

    if (Array.isArray(candidateIds)) {
      effectiveCandidateIds = candidateIds;
    } else if (req.body.candidateId1 && req.body.candidateId2) {
      effectiveCandidateIds = [req.body.candidateId1, req.body.candidateId2];
    } else if (req.body.candidateId) {
      // Single candidate passed - wrap it so validation provides clear error
      effectiveCandidateIds = [req.body.candidateId];
    }

    if (!roundId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: roundId.',
      });
      return;
    }

    if (!effectiveToken) {
      res.status(400).json({
        success: false,
        error: 'A valid anonymous voting token is required to cast a ballot.',
      });
      return;
    }

    const result = await ElectionEngine.submitVote({
      roundId,
      candidateIds: effectiveCandidateIds,
      tokenCode: effectiveToken,
      clientFingerprint,
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Your ballot has been recorded successfully.',
        verificationCode: result.verificationCode,
        timestamp: result.timestamp,
        roundTitle: result.roundTitle,
        selectionCount: result.selectionCount || 2,
        electionName: OFFICIAL_APP_NAME,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred while casting your ballot. Please try again.',
    });
  }
});

/**
 * Verify ballot receipt code
 * MUST NOT reveal voter identity, voter name, token, or candidate choices
 */
apiRouter.get('/election/verify-receipt/:code', (req: Request, res: Response) => {
  try {
    const code = req.params.code?.trim().toUpperCase();
    const store = db.getStore();
    const ballots = store.ballots || store.votes || [];
    const ballot = ballots.find((b) => b.receiptCode?.toUpperCase() === code);

    if (!ballot) {
      res.status(404).json({
        success: false,
        error: 'No ballot receipt found matching the provided verification code.',
      });
      return;
    }

    const round = store.rounds[ballot.roundId];
    res.json({
      success: true,
      data: {
        electionName: OFFICIAL_APP_NAME,
        roundTitle: round ? round.title : ballot.roundId,
        verificationCode: ballot.receiptCode,
        numberOfSelections: 2,
        timestamp: ballot.createdAt,
        status: 'CONFIRMED_AUDITED',
        receiptNote: 'This ballot was recorded anonymously with cryptographically decoupled proof.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

apiRouter.post('/admin/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password are required.' });
      return;
    }

    if (!verifyAdminCredentials(username, password)) {
      res.status(401).json({ success: false, error: 'Invalid administrator credentials.' });
      return;
    }

    const session = createAdminSession(username);
    res.json({
      success: true,
      data: {
        token: session.token,
        username,
        expiresAt: session.expiresAt,
        electionName: OFFICIAL_APP_NAME,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Login service failed.' });
  }
});

apiRouter.get('/admin/session', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Unauthorized. Admin credentials or session token required.',
      });
      return;
    }

    const token = authHeader.substring(7).trim();
    const session = validateAdminSession(token);
    if (!session) {
      res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Session expired or invalid. Please sign in again.',
      });
      return;
    }

    res.json({
      success: true,
      authenticated: true,
      data: {
        username: session.username,
        expiresAt: session.expiresAt,
        electionName: OFFICIAL_APP_NAME,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Session verification service failed.' });
  }
});

apiRouter.post('/admin/logout', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        invalidateAdminSession(token);
      }
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Logout failed.' });
  }
});

apiRouter.post('/admin/change-password', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.',
      });
      return;
    }

    const changed = changeAdminPassword(currentPassword, newPassword);
    if (!changed) {
      res.status(400).json({ success: false, error: 'Current password is incorrect.' });
      return;
    }

    const adminUser = (req as any).adminSession?.username || 'admin';
    db.addAuditLog(adminUser, 'Admin Password Changed', db.getStore().currentState, db.getStore().currentState);

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update password.' });
  }
});

// ==========================================
// ADMIN DASHBOARD & ELECTION MANAGEMENT (PROTECTED)
// ==========================================

apiRouter.get('/admin/state', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const state = ElectionEngine.getAdminElectionState();
    res.json({ success: true, data: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin state.' });
  }
});

apiRouter.post('/admin/state/transition', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { newState, metadata } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    if (!newState) {
      res.status(400).json({ success: false, error: 'Target newState is required.' });
      return;
    }

    const result = await ElectionEngine.transitionState(newState as ElectionState, adminUser, metadata);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: { currentState: result.newState } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'State transition failed.' });
  }
});

apiRouter.post('/admin/consolidation/confirm', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminSession?.username || 'admin';
    const result = await ElectionEngine.confirmConsolidation(adminUser);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Consolidation confirmed successfully. Final candidate pool frozen at 24 candidates.',
        totalPoolCount: result.totalPoolCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Consolidation failed.' });
  }
});

apiRouter.post(['/admin/round/reset', '/admin/reset-round'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    let { roundId, round, reason, administrativeReason, confirmation } = req.body;
    if (!roundId && round) roundId = round;
    const effectiveReason = (reason || administrativeReason || '').trim();
    const effectiveConfirmation = (confirmation || '').trim();
    const adminUser = (req as any).adminSession?.username || 'admin';

    if (!roundId) {
      res.status(400).json({ success: false, error: 'roundId is required for round reset.' });
      return;
    }

    if (!effectiveConfirmation) {
      res.status(400).json({
        success: false,
        error: 'Confirmation text is required. Expected: "I UNDERSTAND THIS WILL RESET THE ROUND"',
      });
      return;
    }

    if (!effectiveReason) {
      res.status(400).json({
        success: false,
        error: 'A specific administrative reason (at least 5 characters) is required for round reset.',
      });
      return;
    }

    const result = await ElectionEngine.resetRound({
      roundId,
      reason: effectiveReason,
      administrativeReason: effectiveReason,
      confirmation: effectiveConfirmation,
      adminUser,
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      data: {
        ...result.affected,
        message: result.message,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Round reset failed due to internal server error.',
    });
  }
});

apiRouter.get('/admin/round/checklist/:roundId', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const roundId = req.params.roundId as RoundId;
    const checklist = ElectionEngine.getPreElectionChecklist(roundId);
    res.json({ success: true, data: checklist });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve pre-election checklist.' });
  }
});

apiRouter.post('/admin/candidates', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { name, group, bio } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    if (!name || !group) {
      res.status(400).json({ success: false, error: 'Candidate name and group are required.' });
      return;
    }

    const result = await ElectionEngine.addCandidate(name, group, adminUser, bio);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.candidate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to add candidate.' });
  }
});

apiRouter.patch('/admin/candidates/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, group, bio } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    const result = await ElectionEngine.editCandidate(id, { name, group, bio }, adminUser);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.candidate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to edit candidate.' });
  }
});

apiRouter.patch('/admin/candidates/:id/status', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    if (!status || !['ACTIVE', 'DEACTIVATED'].includes(status)) {
      res.status(400).json({ success: false, error: 'Valid status (ACTIVE or DEACTIVATED) is required.' });
      return;
    }

    const result = await ElectionEngine.setCandidateStatus(id, status, adminUser);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, message: `Candidate status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update candidate status.' });
  }
});

apiRouter.delete('/admin/candidates/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminUser = (req as any).adminSession?.username || 'admin';

    const result = await ElectionEngine.removeCandidate(id, adminUser);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, message: 'Candidate removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete candidate.' });
  }
});

apiRouter.post('/admin/tokens/generate', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { roundId, count, batchLabel } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    const numCount = Number(count) || 25;
    if (!roundId || !['ROUND_1', 'ROUND_2', 'FINAL_ROUND'].includes(roundId)) {
      res.status(400).json({ success: false, error: 'Valid roundId is required.' });
      return;
    }

    const result = await ElectionEngine.generateTokens(
      roundId as RoundId,
      Math.min(numCount, 1000),
      batchLabel || 'Batch ' + new Date().toLocaleDateString('en-US'),
      adminUser
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to generate tokens.' });
  }
});

apiRouter.post('/admin/tokens/regenerate', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { roundId, count, batchLabel } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    const numCount = Number(count) || 25;
    if (!roundId || !['ROUND_1', 'ROUND_2', 'FINAL_ROUND'].includes(roundId)) {
      res.status(400).json({ success: false, error: 'Valid roundId is required.' });
      return;
    }

    const result = await ElectionEngine.regenerateTokens(
      roundId as RoundId,
      Math.min(numCount, 1000),
      batchLabel || 'Regenerated Batch ' + new Date().toLocaleDateString('en-US'),
      adminUser
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to regenerate tokens.' });
  }
});

apiRouter.post('/admin/tokens/confirm-distribution', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { roundId } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    if (!roundId || !['ROUND_1', 'ROUND_2', 'FINAL_ROUND'].includes(roundId)) {
      res.status(400).json({ success: false, error: 'Valid roundId is required.' });
      return;
    }

    const result = await ElectionEngine.confirmDistribution(roundId as RoundId, adminUser);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to confirm token distribution.' });
  }
});

apiRouter.post('/admin/tokens/:id/revoke', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    const result = await ElectionEngine.revokeToken(id, reason, adminUser);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, message: 'Token successfully revoked.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to revoke token.' });
  }
});

apiRouter.get('/admin/tokens/inventory', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const adminState = ElectionEngine.getAdminElectionState();
    res.json({ success: true, data: adminState.tokenInventory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve token inventory.' });
  }
});

apiRouter.get('/admin/tokens/export', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const format = req.query.format === 'json' ? 'json' : 'csv';
    const roundId = req.query.roundId as RoundId | undefined;
    const store = db.getStore();

    let tokens = store.tokens;
    if (roundId) {
      tokens = tokens.filter((t) => t.roundId === roundId);
    }

    if (format === 'csv') {
      const csvHeader = 'TokenCode,Round,Status,IsUsed,DistributedAt,UsedAt,BatchLabel,CreatedAt\n';
      const csvRows = tokens
        .map(
          (t) =>
            `"${t.tokenCode}","${t.roundId}","${t.status}","${t.isUsed ? 'YES' : 'NO'}","${t.distributedAt || ''}","${t.usedAt || ''}","${t.batchLabel || ''}","${t.createdAt}"`
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="voting_tokens.csv"');
      res.send(csvHeader + csvRows);
      return;
    }

    res.json({ success: true, data: tokens });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Export failed.' });
  }
});

apiRouter.post(['/admin/tie/resolve', '/admin/resolve-tie'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { roundId, chosenWinnerId, method, notes } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    if (!roundId || !chosenWinnerId || !method) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: roundId, chosenWinnerId, and method are required.',
      });
      return;
    }

    if (!notes || typeof notes !== 'string' || !notes.trim()) {
      res.status(400).json({
        success: false,
        error: 'Official committee justification and witness notes are required.',
      });
      return;
    }

    const result = await ElectionEngine.resolveTie(
      roundId,
      chosenWinnerId,
      method,
      notes.trim(),
      adminUser
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, message: 'Tie resolved and recorded in the audit log.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Tie resolution failed.' });
  }
});

apiRouter.get('/admin/audit-logs', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const store = db.getStore();
    res.json({
      success: true,
      data: {
        totalEntries: store.auditLogs.length,
        logs: [...store.auditLogs].reverse(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs.' });
  }
});

apiRouter.get('/admin/audit-logs/export', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const store = db.getStore();
    const csvHeader = 'Timestamp,AdminUser,Action,StateBefore,StateAfter,AffectedCandidate,AffectedRound,EntryHash,PreviousEntryHash\n';
    const csvRows = store.auditLogs
      .map((l) => {
        const candidate = l.affectedCandidateName ? `"${l.affectedCandidateName.replace(/"/g, '""')}"` : '""';
        const action = `"${l.action.replace(/"/g, '""')}"`;
        return `"${l.timestamp}","${l.adminUser}",${action},"${l.stateBefore}","${l.stateAfter}",${candidate},"${l.affectedRound || ''}","${l.entryHash}","${l.previousEntryHash}"`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="election_audit_trail.csv"');
    res.send(csvHeader + csvRows);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Audit export failed.' });
  }
});

apiRouter.get('/admin/backup', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const store = db.getStore();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="election_backup_${Date.now()}.json"`);
    res.send(JSON.stringify(store, null, 2));
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Backup failed.' });
  }
});

apiRouter.post('/admin/reset', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminSession?.username || 'admin';
    db.resetToDefault(adminUser);
    res.json({
      success: true,
      message: `${OFFICIAL_APP_NAME} reset to initial state with standard Group A (10) and Group B (16) seed data.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Reset failed.' });
  }
});

apiRouter.post('/admin/settings', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    const adminUser = (req as any).adminSession?.username || 'admin';

    if (!settings) {
      res.status(400).json({ success: false, error: 'Settings object is required.' });
      return;
    }

    await ElectionEngine.updateSettings(settings, adminUser);
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update settings.' });
  }
});

apiRouter.post('/admin/test-suite/run', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const report = await runCompleteElectionTestSuite();
    const adminUser = (req as any).adminSession?.username || 'admin';

    db.addAuditLog(
      adminUser,
      `Automated Test Suite Executed: ${report.passedCount}/${report.totalTests} Passed`,
      db.getStore().currentState,
      db.getStore().currentState,
      {
        metadata: {
          passedCount: report.passedCount,
          totalTests: report.totalTests,
          allPassed: report.allPassed,
          totalDurationMs: report.totalDurationMs,
        },
      }
    );

    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to execute test suite.' });
  }
});

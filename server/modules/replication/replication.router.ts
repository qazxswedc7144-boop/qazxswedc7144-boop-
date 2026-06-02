// server/modules/replication/replication.router.ts

import { Router, Response } from "express";
import { authenticateToken, requireRoles, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { Role } from "@prisma/client";
import { ReplicationService } from "./replication.service";
import { ReplicationPublisher } from "./replication.publisher";
import { ReplicationGateway } from "./replication.gateway";
import { BusinessEventType } from "./replication.types";

const replicationRouter = Router();

// Authorized roles
const REPLICATION_ROLES = [
  Role.ADMIN,
  Role.ACCOUNTANT,
  Role.PHARMACIST,
  Role.INVENTORY_MANAGER,
];

/**
 * GET /api/replication/status
 * Fetches real-time status and telemetry variables
 */
replicationRouter.get(
  "/status",
  authenticateToken,
  requireRoles(REPLICATION_ROLES),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await ReplicationService.getReplicationMetrics();
      const activeSessions = ReplicationGateway.getActiveSessions();
      return res.json({
        success: true,
        ...stats,
        activeSessions,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: err.message,
      });
    }
  }
);

/**
 * POST /api/replication/recover
 * Replays missed events for a branch that was disconnected
 */
replicationRouter.post(
  "/recover",
  authenticateToken,
  requireRoles(REPLICATION_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { branchId, lastKnownSequence, vectorClock } = req.body;

      if (!branchId || lastKnownSequence === undefined) {
        return res.status(400).json({
          success: false,
          error: "MALFORMED_REQUEST",
          message: "branchId and lastKnownSequence are required.",
        });
      }

      const response = await ReplicationService.recoverMissedEvents(
        {
          branchId,
          lastKnownSequence: Number(lastKnownSequence),
          vectorClock: vectorClock || {},
        },
        req.user?.userId
      );

      return res.json({
        success: true,
        ...response,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: err.message,
      });
    }
  }
);

/**
 * GET /api/replication/replay
 * Fetches the historical log of sync events for replay operations
 */
replicationRouter.get(
  "/replay",
  authenticateToken,
  requireRoles(REPLICATION_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const originBranchId = req.query.originBranchId as string | undefined;
      const type = req.query.type as BusinessEventType | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const events = await ReplicationService.replayEventStream({
        originBranchId,
        type,
        limit,
        userId: req.user?.userId,
      });

      return res.json({
        success: true,
        events,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: err.message,
      });
    }
  }
);

/**
 * POST /api/replication/test-publish
 * Triggers a manual replication event for demonstration/testing/diagnostic purposes
 */
replicationRouter.post(
  "/test-publish",
  authenticateToken,
  requireRoles(REPLICATION_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, branchId, payload, targetBranchId } = req.body;

      if (!type || !branchId || !payload) {
        return res.status(400).json({
          success: false,
          error: "MALFORMED_REQUEST",
          message: "type, branchId, and payload are required fields.",
        });
      }

      const event = await ReplicationPublisher.publish({
        type,
        branchId,
        payload,
        userId: req.user?.userId,
        targetBranchId,
      });

      return res.json({
        success: true,
        event,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: err.message,
      });
    }
  }
);

export { replicationRouter };
export default replicationRouter;

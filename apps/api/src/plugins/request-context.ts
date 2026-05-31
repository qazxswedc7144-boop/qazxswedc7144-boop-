// apps/api/src/plugins/request-context.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface RequestContext {
  requestId: string;
  traceId: string;
  userId?: string;
  role?: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: string;
}

export interface ContextualRequest extends Request {
  context?: RequestContext;
}

/**
 * Enterprise Request Context plugin.
 * Generates unique execution flows, maps clients, and configures trace contexts.
 */
export function requestContextPlugin(req: ContextualRequest, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID();
  const traceId = (req.headers["x-trace-id"] as string) || crypto.randomUUID();
  const ipAddress = (req.ip || req.socket.remoteAddress || "127.0.0.1").replace("::ffff:", "");

  req.context = {
    requestId,
    traceId,
    ipAddress,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString()
  };

  // Expose headers for external trace mapping
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Trace-Id", traceId);

  next();
}

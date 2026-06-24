// server/modules/idempotency/idempotency.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { IdempotencyService } from "./idempotency.service";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: any;
  };
}

const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * Enterprise Idempotency Middleware.
 * Enforces transaction uniqueness based on 'Idempotency-Key' and SHA-256 integrity signature of the request payload.
 */
export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const keyHeader = req.headers["idempotency-key"];
  
  if (!keyHeader) {
    // No idempotency key supplied; bypass validation
    return next();
  }

  const rawKey = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  const key = rawKey || "";

  // Enforce basic spacing/length rules
  if (!key.trim()) {
    return res.status(400).json({
      error: "BAD_REQUEST",
      message: "Idempotency-Key header is supplied but cannot be empty."
    });
  }

  const authReq = req as AuthenticatedRequest;
  let userId = authReq.user?.userId || null;

  // Resilient JWT decode fallback if loaded globally before main authenticateToken
  if (!userId && req.headers["authorization"]) {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded?.userId || null;
      }
    } catch {
      // safe fallback
    }
  }

  const endpoint = req.originalUrl || req.path;
  const method = req.method;


  try {
    const result = await IdempotencyService.handlePreRequest(
      key,
      endpoint,
      method,
      req.body,
      userId
    );

    if (result.status === "REPLAY") {
      // Replay original response payload
      res.setHeader("X-Cache-Lookup", "HIT - Idempotent Replay");
      return res.status(result.code).json(result.body);
    }

    // Capture response to persist upon completion
    const originalSend = res.send;
    let answered = false;

    res.send = function (chunk: any) {
      if (answered) {
        return originalSend.apply(this, arguments as any);
      }
      answered = true;

      const responseStatus = res.statusCode;
      let parsedBody = chunk;

      if (typeof chunk === "string") {
        try {
          parsedBody = JSON.parse(chunk);
        } catch {
          // Keep raw string if not JSON format
        }
      }

      // Persist to DB if successful (status < 500)
      if (responseStatus < 500) {
        IdempotencyService.resolveRequest(key, responseStatus, parsedBody).catch((err) => {
          console.error(`[Idempotency] Failed to resolve key cache for: ${key}`, err);
        });
      } else {
        // Release lock on server errors for retries
        IdempotencyService.releaseLock(key).catch((err) => {
          console.error(`[Idempotency] Failed to release lock on server error for: ${key}`, err);
        });
      }

      return originalSend.apply(this, arguments as any);
    };

    // Connection closed prematurely safety
    res.on("close", () => {
      if (!answered) {
        IdempotencyService.releaseLock(key).catch(() => {});
      }
    });

    next();
  } catch (error: any) {
    if (error.message === "CONCURRENT_LOCK") {
      return res.status(409).json({
        error: "CONFLICT",
        message: "A parallel request with this Idempotency-Key is already in progress, or locked in transaction."
      });
    }

    if (error.message === "HASH_MISMATCH") {
      return res.status(409).json({
        error: "CONFLICT",
        message: "Idempotency key reuse detected with different payload"
      });
    }

    console.error(`[Idempotency] Middleware fatal error for key ${key}:`, error);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || String(error),
      stack: error.stack
    });
  }
}

// server/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: Role;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "pharmaflow-backend-super-secret-key-2026-xyz";

/**
 * Validates the JWT Bearer Token in authorization headers
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Access token is missing in request headers."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as AuthenticatedRequest).user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role as Role
    };
    next();
    return;
  } catch (err) {
    return res.status(403).json({
      error: "INVALID_TOKEN",
      message: "Provided access token is expired, revoked, or malformed."
    });
  }
}

/**
 * Validates if the authenticated user possesses the correct Role from the RBAC hierarchy
 */
export function requireRoles(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (!authenticatedReq.user) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Authentication is required to perform this action."
      });
    }

    if (!allowedRoles.includes(authenticatedReq.user.role)) {
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: `Your role (${authenticatedReq.user.role}) is unauthorized to access this resource.`
      });
    }

    next();
    return;
  };
}

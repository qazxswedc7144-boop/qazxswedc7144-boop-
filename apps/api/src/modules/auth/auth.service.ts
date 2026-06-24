// apps/api/src/modules/auth/auth.service.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../../../../server/database/prisma";
import { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export interface DecodedAccessToken {
  userId: string;
  username: string;
  role: Role;
}

export interface DecodedRefreshToken {
  userId: string;
}

export class AuthService {
  /**
   * Secure bcrypt salt generation and hashing with 12 cycles.
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Standard secure comparison of plain texts against stored hashes.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Token generator representing valid authorization duration (e.g., 1 hour).
   */
  static generateAccessToken(user: { id: string; username: string; role: Role }): string {
    return jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "4h" }
    );
  }

  /**
   * Refreshes JWT tokens allowing users to request a new session within 7 days.
   */
  static generateRefreshToken(user: { id: string }): string {
    return jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
  }

  /**
   * Safe payload parsing for verification of access signatures.
   */
  static verifyAccessToken(token: string): DecodedAccessToken {
    return jwt.verify(token, JWT_SECRET) as DecodedAccessToken;
  }

  /**
   * Safe payload parsing for verification of refresh signatures.
   */
  static verifyRefreshToken(token: string): DecodedRefreshToken {
    return jwt.verify(token, JWT_REFRESH_SECRET) as DecodedRefreshToken;
  }

  /**
   * Generates or retrieves active server-side sessions.
   */
  static async createSession(userId: string, token: string, ip?: string, agent?: string) {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours
    return prisma.session.create({
      data: {
        userId,
        token,
        ipAddress: ip || null,
        userAgent: agent || null,
        expiresAt
      }
    });
  }

  /**
   * Refreshes access tokens when validated against the database refresh tokens.
   */
  static async createRefreshTokenRecord(userId: string, token: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  }

  /**
   * Revokes matching tokens to secure session termination.
   */
  static async revokeSession(token: string) {
    try {
      await prisma.session.delete({
        where: { token }
      });
    } catch (e) {
      // Already deleted or non-existent
    }
  }

  static async revokeRefreshToken(token: string) {
    try {
      await prisma.refreshToken.update({
        where: { token },
        data: { revoked: true }
      });
    } catch (e) {
      // Already revoked or non-existent
    }
  }
}

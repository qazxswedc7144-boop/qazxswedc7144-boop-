// server/routes/auth.routes.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../database/prisma";
import { Role } from "@prisma/client";
import { RegisterSchema, LoginSchema } from "../../src/shared/validation/auth.schema";
import { validateRequestBody } from "../middleware/validate";

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "pharmaflow-backend-super-secret-key-2026-xyz";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "pharmaflow-backend-refresh-secret-2026";

/**
 * POST /api/auth/register
 * Creating a new system user with Role
 */
authRouter.post("/register", validateRequestBody(RegisterSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body; // already sanitized and parsed by the middleware

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { username: data.username }
    });

    if (existing) {
      return res.status(400).json({
        error: "USER_ALREADY_EXISTS",
        message: `اسم المستخدم "${data.username}" مسجل مسبقاً في النظام.`
      });
    }

    // Hash password safely with rounds of salt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        role: data.role || Role.CASHIER
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_REGISTER",
        entity: "User",
        entityId: user.id,
        before: null,
        after: JSON.stringify({ id: user.id, username: user.username, role: user.role }),
        ipAddress: req.ip
      }
    });

    return res.status(201).json({
      success: true,
      user
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

/**
 * POST /api/auth/login
 * Standard user authenticate credentials
 */
authRouter.post("/login", validateRequestBody(LoginSchema), async (req: Request, res: Response) => {
  try {
    const data = req.body; // already sanitized and parsed by middleware

    const user = await prisma.user.findUnique({
      where: { username: data.username }
    });

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "خطأ في اسم المستخدم أو كلمة المرور."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: "ACCOUNT_SUSPENDED",
        message: "أنت لا تملك الصلاحية لتسجيل الدخول: حسابك غير نشط حالياً."
      });
    }

    // Sign Access JWT Token & Refresh token
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // Save login audit trace
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        entity: "User",
        entityId: user.id,
        before: null,
        after: "TOKEN_GENERATED",
        ipAddress: req.ip
      }
    });

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

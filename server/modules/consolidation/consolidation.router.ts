// server/modules/consolidation/consolidation.router.ts

import { Router, Response } from "express";
import { authenticateToken, requireRoles, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { ConsolidationService } from "./consolidation.service";
import { Role } from "@prisma/client";

const router = Router();

// Define RBAC rule guarding all endpoints to ADMIN, ACCOUNTANT, AUDITOR roles
const permittedRoles: Role[] = [Role.ADMIN, Role.ACCOUNTANT, Role.AUDITOR];

const rbacGuards = [authenticateToken, requireRoles(permittedRoles)];

/**
 * GET /api/consolidation/summary
 * Retrieves master group financial summary
 */
router.get("/summary", rbacGuards, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const force = req.query.refresh === "true";
    const userId = req.user?.userId || "SYSTEM";
    const summary = await ConsolidationService.generateMasterConsolidationSummary(userId, force);
    res.json(summary);
  } catch (err: any) {
    console.error("[CONSOLIDATION API Error summary]:", err);
    res.status(500).json({
      error: "CONSOLIDATION_FAILED",
      message: err.message || "Failed to generate master financial consolidation summary."
    });
  }
});

/**
 * GET /api/consolidation/balance-sheet
 * Retrieves Consolidated Balance Sheet
 */
router.get("/balance-sheet", rbacGuards, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const force = req.query.refresh === "true";
    const userId = req.user?.userId || "SYSTEM";
    const balanceSheet = await ConsolidationService.generateBalanceSheet(userId, force);
    res.json(balanceSheet);
  } catch (err: any) {
    console.error("[CONSOLIDATION API Error balance-sheet]:", err);
    res.status(500).json({
      error: "CONSOLIDATION_FAILED",
      message: err.message || "Failed to generate consolidated balance sheet."
    });
  }
});

/**
 * GET /api/consolidation/income-statement
 * Retrieves Consolidated Income Statement
 */
router.get("/income-statement", rbacGuards, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const force = req.query.refresh === "true";
    const userId = req.user?.userId || "SYSTEM";
    const incomeStatement = await ConsolidationService.generateIncomeStatement(userId, force);
    res.json(incomeStatement);
  } catch (err: any) {
    console.error("[CONSOLIDATION API Error income-statement]:", err);
    res.status(500).json({
      error: "CONSOLIDATION_FAILED",
      message: err.message || "Failed to generate consolidated income statement."
    });
  }
});

/**
 * GET /api/consolidation/cash-flow
 * Retrieves Consolidated Cash Flow
 */
router.get("/cash-flow", rbacGuards, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const force = req.query.refresh === "true";
    const userId = req.user?.userId || "SYSTEM";
    const cashFlow = await ConsolidationService.generateCashFlow(userId, force);
    res.json(cashFlow);
  } catch (err: any) {
    console.error("[CONSOLIDATION API Error cash-flow]:", err);
    res.status(500).json({
      error: "CONSOLIDATION_FAILED",
      message: err.message || "Failed to generate consolidated cash flow."
    });
  }
});

/**
 * GET /api/consolidation/trial-balance
 * Retrieves Consolidated Trial Balance
 */
router.get("/trial-balance", rbacGuards, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const force = req.query.refresh === "true";
    const userId = req.user?.userId || "SYSTEM";
    const trialBalance = await ConsolidationService.generateTrialBalance(userId, force);
    res.json(trialBalance);
  } catch (err: any) {
    console.error("[CONSOLIDATION API Error trial-balance]:", err);
    res.status(500).json({
      error: "CONSOLIDATION_FAILED",
      message: err.message || "Failed to generate consolidated trial balance."
    });
  }
});

/**
 * GET /api/consolidation/inventory
 * Retrieves Consolidated Inventory Valuation and velocity analytics
 */
router.get("/inventory", rbacGuards, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const force = req.query.refresh === "true";
    const inventory = await ConsolidationService.generateInventoryValuation(force);
    res.json(inventory);
  } catch (err: any) {
    console.error("[CONSOLIDATION API Error inventory]:", err);
    res.status(500).json({
      error: "CONSOLIDATION_FAILED",
      message: err.message || "Failed to generate consolidated inventory valuation stats."
    });
  }
});

export { router as consolidationRouter };

// src/types/ai.types.ts
import { SyncableEntity } from "./common.types";

export interface AIInsight extends SyncableEntity {
  id: string;
  type: 'TREND' | 'PERFORMANCE' | 'BEHAVIOR' | 'COST' | 'RISK';
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  data?: any;
  timestamp: string;
}

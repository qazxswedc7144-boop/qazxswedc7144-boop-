// src/types/database.types.ts
import { SyncableEntity } from "./common.types";

export interface DatabaseBackupSnapshot extends SyncableEntity {
  id: string;
  timestamp: string;
  data: any;
  type: 'AUTO' | 'MANUAL';
}

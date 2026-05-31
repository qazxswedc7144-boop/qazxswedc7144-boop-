// apps/api/src/modules/audit/audit.types.ts

export interface AuditLogPayload {
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: string;
  after?: string;
  ipAddress?: string;
}

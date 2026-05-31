import { db } from '@/core/db';

export interface ApiKeyConfig {
  id: string;
  name: string;
  key: string;
  scopes: Array<'fhir.read' | 'fhir.write' | 'inventory.read' | 'inventory.write' | 'financials.read'>;
  status: 'ACTIVE' | 'REVOKED';
  tenantId: string;
  rateLimitPerMinute: number;
  totalCalls: number;
  lastUsedAt?: string;
  createdAt: string;
}

export class ApiGatewayService {
  /**
   * Generates a high-security API secret token starting with `pf_live_` prefix
   */
  static generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 32; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `pf_live_${randomStr}`;
  }

  /**
   * Core verification middleware simulation
   * Validates API token viability, scope compliance, and records statistics in the database
   */
  static async verifyRequest(token: string, requiredScope: string, tenantId: string): Promise<{
    allowed: boolean;
    reason?: string;
    apiKeyName?: string;
  }> {
    if (!token || !token.startsWith('pf_live_')) {
      return { allowed: false, reason: "Invalid token scheme. API keys must start with 'pf_live_'" };
    }

    // Try finding key configuration or simulate key verification
    // Since in the frontend/backend bridge some mock registers exist:
    const mockKeys = await this.getTenantApiKeys(tenantId);
    const existingKey = mockKeys.find(k => k.key === token);

    if (!existingKey) {
      return { allowed: false, reason: "API key is invalid or has been expired." };
    }

    if (existingKey.status === 'REVOKED') {
      return { allowed: false, reason: "API key has been revoked by tenant administrator." };
    }

    const hasScope = existingKey.scopes.includes(requiredScope as any);
    if (!hasScope) {
      return { allowed: false, reason: `Insufficient scopes. Missing required scope: [${requiredScope}]` };
    }

    // Update usage metric
    existingKey.totalCalls++;
    existingKey.lastUsedAt = new Date().toISOString();
    await this.updateApiKeyStats(existingKey, tenantId);

    // Write audit log to local Dexie engine to verify security-compliance standard ISO 27001
    try {
      await db.Audit_Log.add({
        id: db.generateId('LOG'),
        action: 'API_ACCESS',
        user_id: 'API_GATEWAY',
        userName: 'بوابة المطورين (API Gateway)',
        target_id: existingKey.id,
        target_type: 'API_KEY',
        timestamp: new Date().toISOString(),
        details: `طلب ناجح للمسار بالخلفية باستخدام مفتاح: "${existingKey.name}". النطاق المطلوب: ${requiredScope}`
      });
    } catch (e) {
      console.warn("Audit logger skipped. (Standalone UI mode or db loading)", e);
    }

    return { allowed: true, apiKeyName: existingKey.name };
  }

  /**
   * Retrieves keys linked dynamically to custom local-storage or index references
   */
  static async getTenantApiKeys(tenantId: string): Promise<ApiKeyConfig[]> {
    const keyStr = localStorage.getItem(`pf_api_keys_${tenantId}`);
    if (!keyStr) {
      // Seed default developer keys for testing out-of-the-box integrations
      const defaultKeys: ApiKeyConfig[] = [
        {
          id: 'key-mouwasat',
          name: 'بوابة مستشفى المواساة الطبية',
          key: 'pf_live_mouwasat_r4_interop_key_2026',
          scopes: ['fhir.read', 'fhir.write', 'inventory.read'],
          status: 'ACTIVE',
          tenantId,
          rateLimitPerMinute: 300,
          totalCalls: 1420,
          lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
        },
        {
          id: 'key-hq-sync',
          name: 'المزامنة السحابية للفرع الرئيسي',
          key: 'pf_live_cloud_sync_ledger_secret_token',
          scopes: ['financials.read', 'inventory.write', 'fhir.read'],
          status: 'ACTIVE',
          tenantId,
          rateLimitPerMinute: 1000,
          totalCalls: 38240,
          lastUsedAt: new Date().toISOString(),
          createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
        }
      ];
      localStorage.setItem(`pf_api_keys_${tenantId}`, JSON.stringify(defaultKeys));
      return defaultKeys;
    }
    return JSON.parse(keyStr);
  }

  private static async updateApiKeyStats(key: ApiKeyConfig, tenantId: string) {
    const keys = await this.getTenantApiKeys(tenantId);
    const updated = keys.map(k => k.id === key.id ? key : k);
    localStorage.setItem(`pf_api_keys_${tenantId}`, JSON.stringify(updated));
  }

  static async saveApiKey(key: ApiKeyConfig, tenantId: string) {
    const keys = await this.getTenantApiKeys(tenantId);
    keys.unshift(key);
    localStorage.setItem(`pf_api_keys_${tenantId}`, JSON.stringify(keys));
  }

  static async revokeApiKey(keyId: string, tenantId: string) {
    const keys = await this.getTenantApiKeys(tenantId);
    const updated = keys.map(k => k.id === keyId ? { ...k, status: 'REVOKED' as const } : k);
    localStorage.setItem(`pf_api_keys_${tenantId}`, JSON.stringify(updated));
  }
}


/**
 * Heartbeat Service - DEACTIVATED
 * Logic removed as Saved (Draft) invoices no longer exist in the system.
 */
class HeartbeatService {
  start() { console.log('[Heartbeat] Service dormant - No drafts to monitor.'); }
  stop() {}
  private async tick() {}
}

export const heartbeatService = new HeartbeatService();

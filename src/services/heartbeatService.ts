
export class HeartbeatService {
  private intervalId: any = null;

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      console.log('[Heartbeat] System Check OK - ' + new Date().toLocaleTimeString());
    }, 60000); 
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const heartbeatService = new HeartbeatService();

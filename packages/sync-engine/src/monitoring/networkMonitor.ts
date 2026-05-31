// packages/sync-engine/src/monitoring/networkMonitor.ts

export type NetworkStatus = "ONLINE" | "OFFLINE";
export type ConnectionQuality = "EXCELLENT" | "GOOD" | "POOR" | "OFFLINE";

export interface NetworkState {
  status: NetworkStatus;
  quality: ConnectionQuality;
  latencyMs: number;
}

export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private listeners: ((state: NetworkState) => void)[] = [];
  private currentState: NetworkState = {
    status: typeof navigator !== "undefined" && navigator.onLine ? "ONLINE" : "OFFLINE",
    quality: typeof navigator !== "undefined" && navigator.onLine ? "EXCELLENT" : "OFFLINE",
    latencyMs: 0
  };

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private setupListeners() {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      this.handleNetworkChange("ONLINE");
    });

    window.addEventListener("offline", () => {
      this.handleNetworkChange("OFFLINE");
    });

    // Proactive background ping check every 30 seconds if online
    setInterval(() => {
      if (this.currentState.status === "ONLINE") {
        this.pingCheck();
      }
    }, 30000);
  }

  private async handleNetworkChange(status: NetworkStatus) {
    if (status === "OFFLINE") {
      this.currentState = {
        status: "OFFLINE",
        quality: "OFFLINE",
        latencyMs: -1
      };
      this.notify();
    } else {
      await this.pingCheck();
    }
  }

  /**
   * Run a lightweight API ping test to record actual latency and connectivity confirmation.
   */
  public async pingCheck(): Promise<NetworkState> {
    const start = Date.now();
    try {
      // Use standard health point or random fast domain/ping route
      const response = await fetch("/api/v1/sync/status", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      }).catch(() => null);

      if (response && response.ok) {
        const latency = Date.now() - start;
        let quality: ConnectionQuality = "EXCELLENT";
        if (latency > 300) quality = "GOOD";
        if (latency > 1000) quality = "POOR";

        this.currentState = {
          status: "ONLINE",
          quality,
          latencyMs: latency
        };
      } else {
        // HTTP request failed but browser says online, might be walled garden or actual offline
        this.currentState = {
          status: "OFFLINE",
          quality: "OFFLINE",
          latencyMs: -1
        };
      }
    } catch {
      this.currentState = {
        status: "OFFLINE",
        quality: "OFFLINE",
        latencyMs: -1
      };
    }

    this.notify();
    return this.currentState;
  }

  public subscribe(cb: (state: NetworkState) => void): () => void {
    this.listeners.push(cb);
    cb({ ...this.currentState }); // immediate emit

    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.currentState });
      } catch (e) {
        console.error("[NetworkMonitor] Subscription callback error:", e);
      }
    }
  }

  public getSnapshot(): NetworkState {
    return { ...this.currentState };
  }
}

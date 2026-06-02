// server/modules/replication/replication.gateway.ts

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server as HttpServer } from "http";
import url from "url";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { ReplicationSubscriber } from "./replication.subscriber";
import { ReplicationEvent, ClientConnectionInfo } from "./replication.types";

const JWT_SECRET = process.env.JWT_SECRET || "pharmaflow-backend-super-secret-key-2026-xyz";
const AUTHORIZED_ROLES: string[] = [Role.ADMIN, Role.ACCOUNTANT, Role.PHARMACIST, Role.INVENTORY_MANAGER];

interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
  session?: ClientConnectionInfo;
}

export class ReplicationGateway {
  private static wss: WebSocketServer | null = null;
  private static activeSockets = new Map<string, CustomWebSocket>(); // sessionId -> ws

  /**
   * Initializes the WebSocket Server attached to the shared Http/Express server.
   */
  static init(server: HttpServer): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ noServer: true });

    // 1. Hook up the subscriber to push Redis matches directly to clients
    ReplicationSubscriber.addMessageHandler((_channel, event) => {
      this.routeEventToClients(event);
    });

    console.log("[REPLICATION_GATEWAY] WebSocket replication server initialized: listening for upgrade requests on /ws");

    // 2. Intercept Express HTTP Server generic upgrade requests
    server.on("upgrade", (request: IncomingMessage, socket: any, head: Buffer) => {
      try {
        const parsedUrl = url.parse(request.url || "", true);
        const { pathname } = parsedUrl;

        if (pathname === "/ws") {
          // Perform JWT Authentication prior to establishing WS socket handshake
          const token = (parsedUrl.query.token as string) || this.extractTokenFromCookies(request.headers.cookie);
          
          if (!token) {
            console.warn("[REPLICATION_GATEWAY] Connection upgrade rejected: Missing credentials.");
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }

          try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            
            // Validate RBAC roles are authorized to access replication streams
            if (!AUTHORIZED_ROLES.includes(decoded.role)) {
              console.warn(`[REPLICATION_GATEWAY] Connection upgrade rejected: Unauthorized role ${decoded.role}`);
              socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
              socket.destroy();
              return;
            }

            // Authentication succeeded! Continue upgrade.
            this.wss?.handleUpgrade(request, socket, head, (ws) => {
              const branchId = (parsedUrl.query.branchId as string) || decoded.branchId || "GENERIC";
              const session: ClientConnectionInfo = {
                sessionId: Math.random().toString(36).substring(2, 14),
                userId: decoded.userId || "unknown",
                branchId,
                role: decoded.role,
                connectedAt: new Date().toISOString()
              };

              this.wss?.emit("connection", ws, session);
            });
          } catch (jwtErr) {
            console.warn("[REPLICATION_GATEWAY] Connection upgrade rejected: Invalid JWT Token.");
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
          }
        }
      } catch (err: any) {
        console.error("[REPLICATION_GATEWAY] Upgrade intercept failure:", err.message);
        socket.destroy();
      }
    });

    // 3. Handle actual WebSocket connection lifecycles
    this.wss.on("connection", (ws: CustomWebSocket, session: ClientConnectionInfo) => {
      ws.isAlive = true;
      ws.session = session;
      this.activeSockets.set(session.sessionId, ws);

      console.log(`🔌 [REPLICATION_GATEWAY] Client connected: user=${session.userId}, role=${session.role}, branch=${session.branchId} (Sess: ${session.sessionId})`);

      // Send initial acknowledgement handshake to client
      ws.send(JSON.stringify({
        type: "HandshakeAck",
        message: "Successfully connected to PharmaFlow Pro real-time replication gateway.",
        session
      }));

      // Listen for heartbeats (ping/pong) and commands
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (rawMessage: string) => {
        try {
          const msg = JSON.parse(rawMessage);
          
          if (msg.type === "Heartbeat") {
            ws.send(JSON.stringify({ type: "HeartbeatAck", timestamp: Date.now() }));
          } else if (msg.type === "ChangeBranch") {
            // Support dynamially tuning or updating connection branch
            if (ws.session && msg.branchId) {
              const old = ws.session.branchId;
              ws.session.branchId = msg.branchId;
              console.log(`[REPLICATION_GATEWAY] Session ${ws.session.sessionId} switched branch from ${old} to ${msg.branchId}`);
              ws.send(JSON.stringify({ type: "BranchChanged", branchId: msg.branchId }));
            }
          }
        } catch (mErr: any) {
          // ignore parsing error
        }
      });

      ws.on("close", () => {
        this.activeSockets.delete(session.sessionId);
        console.log(`🔌 [REPLICATION_GATEWAY] Client disconnected: session=${session.sessionId}`);
      });

      ws.on("error", (errVal) => {
        console.error(`[REPLICATION_GATEWAY] Error in socket session ${session.sessionId}:`, errVal.message);
        ws.terminate();
      });
    });

    // 4. Heartbeat checking process: periodic ping-pong sweeps
    setInterval(() => {
      this.wss?.clients.forEach((ws: CustomWebSocket) => {
        if (ws.isAlive === false) {
          console.warn(`[REPLICATION_GATEWAY] Client dormant. Terminating session ${ws.session?.sessionId}`);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds interval
  }

  /**
   * Pushes incoming replication events to the correct websocket connections.
   */
  private static routeEventToClients(event: ReplicationEvent): void {
    if (!event || !event.id) return;

    this.activeSockets.forEach((ws) => {
      if (!ws.session || ws.readyState !== WebSocket.OPEN) return;

      const clientBranchId = ws.session.branchId;

      // Anti-loopback guard: We do NOT push the event back to the client that originated it
      if (clientBranchId === event.branchId) {
        return; 
      }

      // Check if event targets this branch:
      // Since it's a multi-branch system, we deliver to other branches connected. 
      // All branches are interested in general syncing (transfers, inventory balances, etc.)
      try {
        ws.send(JSON.stringify({
          type: "ReplicationEvent",
          event
        }));
      } catch (err: any) {
        console.warn(`[REPLICATION_GATEWAY] Failed to send event to session ${ws.session.sessionId}:`, err.message);
      }
    });
  }

  /**
   * Helper to fetch active sessions information for telemetry
   */
  static getActiveSessions(): ClientConnectionInfo[] {
    const list: ClientConnectionInfo[] = [];
    this.activeSockets.forEach((ws) => {
      if (ws.session) {
        list.push(ws.session);
      }
    });
    return list;
  }

  /**
   * Token retrieval utility from headers cookies
   */
  private static extractTokenFromCookies(cookieString?: string): string | null {
    if (!cookieString) return null;
    const cookies = cookieString.split(";");
    for (const cookie of cookies) {
      const parts = cookie.trim().split("=");
      const name = parts[0];
      const value = parts[1];
      if (name === "token" && value) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }
}

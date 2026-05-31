// packages/shared/auth-client.ts
import axios from "axios";
import { Role, Permission, hasPermission } from "../auth/src/rbac";

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    username: string;
    role: Role;
  } | null;
}

export class AuthClient {
  private static state: AuthState = {
    accessToken: null,
    refreshToken: null,
    user: null
  };

  private static apiBase = "/api/v1/auth";

  static init(): void {
    try {
      const stored = localStorage.getItem("pf_enterprise_auth");
      if (stored) {
        this.state = JSON.parse(stored);
      }
    } catch (e) {
      // safe fallback
    }
  }

  private static persist(): void {
    try {
      localStorage.setItem("pf_enterprise_auth", JSON.stringify(this.state));
    } catch (e) {
      // ignore
    }
  }

  static async login(username: string, passwordPlain: string): Promise<{ success: boolean; user?: AuthState['user']; error?: string }> {
    try {
      const response = await axios.post(`${this.apiBase}/login`, {
        username,
        password: passwordPlain
      });

      if (response.data?.success) {
        this.state.accessToken = response.data.accessToken;
        this.state.refreshToken = response.data.refreshToken;
        this.state.user = response.data.user;
        this.persist();
        return { success: true, user: this.state.user };
      }
      return { success: false, error: "Invalid response format from server" };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "خطأ في تسجيل الدخول للنبضة الأساسية";
      return { success: false, error: msg };
    }
  }

  static async refreshToken(): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    try {
      if (!this.state.refreshToken) {
        return { success: false, error: "No active refresh credentials found" };
      }

      const response = await axios.post(`${this.apiBase}/refresh`, {
        refreshToken: this.state.refreshToken
      });

      if (response.data?.success) {
        this.state.accessToken = response.data.accessToken;
        this.persist();
        return { success: true, accessToken: this.state.accessToken };
      }
      return { success: false, error: "Access verification failed" };
    } catch (err: any) {
      this.clear();
      return { success: false, error: err.message || "Auth error" };
    }
  }

  static async logout(): Promise<void> {
    try {
      await axios.post(`${this.apiBase}/logout`, {
        refreshToken: this.state.refreshToken
      }, {
        headers: {
          Authorization: `Bearer ${this.state.accessToken}`
        }
      });
    } catch (e) {
      // ignore network errors or token invalidations
    } finally {
      this.clear();
    }
  }

  static clear(): void {
    this.state = {
      accessToken: null,
      refreshToken: null,
      user: null
    };
    try {
      localStorage.removeItem("pf_enterprise_auth");
    } catch (e) {}
  }

  static getCurrentUser(): AuthState['user'] {
    return this.state.user;
  }

  static getAccessToken(): string | null {
    return this.state.accessToken;
  }

  static can(permission: Permission): boolean {
    if (!this.state.user) return false;
    return hasPermission(this.state.user.role, permission);
  }
}

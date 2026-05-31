// src/shared/network/idempotency.ts
import axios, { InternalAxiosRequestConfig } from "axios";

/**
 * Generates an RFC4122 compliant UUID v4 string.
 * Supports native crypto.randomUUID with high-performance pseudorandom fallback
 * for legacy container scopes and offline web views.
 */
export function generateIdempotencyKey(): string {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Enterprise pre-configured Axios instance
 */
export const financialApiClient = axios.create({
  headers: {
    "Content-Type": "application/json"
  }
});

/**
 * Request Interceptor: Ensures any state-mutating requests (POST, PUT, DELETE) 
 * targeting critical paths automatically carries a unique Idempotency-Key.
 */
financialApiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const isMutating = ["POST", "PUT", "DELETE", "PATCH"].includes(
      config.method?.toUpperCase() || ""
    );

    if (isMutating) {
      // Check if an idempotency key was already set manually
      const existingKey = config.headers.get("Idempotency-Key") || config.headers["Idempotency-Key"];
      
      if (!existingKey) {
        const key = generateIdempotencyKey();
        config.headers.set("Idempotency-Key", key);
      }
    }
    
    // Auto-inject JWT token if present in localStorage to maintain authentication
    if (typeof localStorage !== "undefined") {
      const token = localStorage.getItem("pharmaflow_token");
      if (token && !config.headers.Authorization) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

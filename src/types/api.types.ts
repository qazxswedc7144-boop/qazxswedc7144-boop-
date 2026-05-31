// src/types/api.types.ts

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

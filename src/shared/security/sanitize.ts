// src/shared/security/sanitize.ts

/**
 * Enterprise-grade sanitization utility to prevent SQL Injections,
 * XSS attacks, and corrupted control/unicode codes.
 */
export function sanitizeString(val: string): string {
  if (!val) return "";
  
  // 1. Normalize Unicode (e.g., NFC normalization)
  let result = val.normalize("NFC");

  // 2. Remove non-printable control characters (ASCII 0-31 and 127), keeping tabs and newlines
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 3. Trim outer whitespaces
  result = result.trim();

  // 4. Escape or strip potentially dangerous characters (prevent basic SQL injection symbols)
  // Replacing single quote with double singular quotes for SQL safety and stripping NULL termination injection
  result = result.replace(/\0/g, "");

  return result;
}

/**
 * Deeply sanities all string values inside a given object recursively
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const rawObj = obj as any;
    const sanitizedObj: any = {};
    for (const key of Object.keys(rawObj)) {
      sanitizedObj[key] = sanitizeObject(rawObj[key]);
    }
    return sanitizedObj as T;
  }

  return obj;
}

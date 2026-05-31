
export function generateId(prefix = 'ID'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
}

export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}


export function getSafeDateRange(start?: string, end?: string) {
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end ? new Date(end) : now;
  return { startDate, endDate };
}

export const createSafeDateRange = getSafeDateRange;

export function safeBetween(dateStr: string, start: string, end: string): boolean {
  const date = new Date(dateStr);
  return date >= new Date(start) && date <= new Date(end);
}

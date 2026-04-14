
export function createSafeDateRange(start: any, end: any) {
  try {
    if (!start || !end) {
      console.warn("⚠️ createSafeDateRange: Missing start or end date", { start, end });
      return null;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error("❌ createSafeDateRange: Invalid date format", { start, end });
      return null;
    }

    if (startDate > endDate) {
      console.warn("⚠️ createSafeDateRange: Start date is after end date, swapping them", { start, end });
      return { startDate: endDate, endDate: startDate };
    }

    return { startDate, endDate };
  } catch (err) {
    console.error("❌ createSafeDateRange: Critical error", err);
    return null;
  }
}

/**
 * Returns a Dexie Collection for a safe between query.
 */
export async function safeBetweenQuery(table: string, field: string, start: any, end: any) {
  const range = createSafeDateRange(start, end);
  if (!range) return null;

  try {
    const { db } = await import('../services/database');
    const targetTable = (db as any)[table];
    
    if (!targetTable) {
      console.error(`❌ safeBetweenQuery: Table "${table}" not found`);
      return null;
    }

    if (!field) {
      console.error(`❌ safeBetweenQuery: Field name is required`);
      return null;
    }

    const lower = range.startDate.toISOString();
    const upper = range.endDate.toISOString();

    if (typeof lower !== 'string' || typeof upper !== 'string') return null;

    return targetTable.where(field).between(lower, upper, true, true);
  } catch (err) {
    console.error(`❌ safeBetweenQuery failed for ${table}.${field}:`, err);
    return null;
  }
}

/**
 * Executes a safe Dexie between query, ensuring keys are valid for IDBKeyRange.
 */
export async function safeBetween(table: string, field: string, start: any, end: any) {
  const query = await safeBetweenQuery(table, field, start, end);
  if (!query) return [];
  
  try {
    return await query.toArray();
  } catch (err) {
    console.error(`❌ safeBetween failed for ${table}.${field}:`, err);
    return [];
  }
}

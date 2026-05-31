
export async function safeGetById<T>(table: any, id: string): Promise<T | null> {
  try {
    const result = await table.get(id);
    return result || null;
  } catch (error) {
    console.error(`[DexieSafe] Error getting record by id: ${id}`, error);
    return null;
  }
}

export async function safeBulkAdd(table: any, items: any[]) {
  try {
    await table.bulkAdd(items);
    return true;
  } catch (error) {
    console.error(`[DexieSafe] Error in bulkAdd`, error);
    return false;
  }
}

export async function safeWhereEqual<T>(table: any, field: string, value: any): Promise<T[]> {
  try {
    return await table.where(field).equals(value).toArray();
  } catch (error) {
    console.error(`[DexieSafe] Error in safeWhereEqual for ${field} = ${value}`, error);
    return [];
  }
}

export async function safeWhereAbove<T>(table: any, field: string, value: any): Promise<T[]> {
  try {
    return await table.where(field).above(value).toArray();
  } catch (error) {
    console.error(`[DexieSafe] Error in safeWhereAbove for ${field} > ${value}`, error);
    return [];
  }
}

export async function safeEquals<T>(table: any, field: string, value: any): Promise<T[]> {
  return await safeWhereEqual(table, field, value);
}

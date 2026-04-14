
/**
 * Dexie Safe Query Wrappers
 * Prevents IDBKeyRange errors by validating keys before database operations.
 */

const isValidKey = (val: any) => {
  return val !== undefined && val !== null && val !== '';
};

export const safeGetById = async (table: any, id: any) => {
  if (!isValidKey(id)) {
    console.warn("Invalid ID provided to safeGetById:", id);
    return null;
  }
  return await table.get(id);
};

export const safeWhereEqual = async (table: any, field: string, value: any) => {
  if (!isValidKey(value)) {
    console.warn(`Invalid value provided to safeWhereEqual for field ${field}:`, value);
    return [];
  }
  return await table.where(field).equals(value).toArray();
};

export const safeBetween = async (table: any, field: string, from: any, to: any) => {
  if (!isValidKey(from) || !isValidKey(to)) {
    console.warn(`Invalid range provided to safeBetween for field ${field}:`, from, to);
    return [];
  }
  return await table.where(field).between(from, to).toArray();
};

export const safeWhereAbove = async (table: any, field: string, value: any) => {
  if (!isValidKey(value)) {
    console.warn(`Invalid value provided to safeWhereAbove for field ${field}:`, value);
    return [];
  }
  return await table.where(field).above(value).toArray();
};

export const safeWhereAboveOrEqual = async (table: any, field: string, value: any) => {
  if (!isValidKey(value)) {
    console.warn(`Invalid value provided to safeWhereAboveOrEqual for field ${field}:`, value);
    return [];
  }
  return await table.where(field).aboveOrEqual(value).toArray();
};

export const safeWhereStartsWith = async (table: any, field: string, value: string) => {
  if (!isValidKey(value)) {
    console.warn(`Invalid value provided to safeWhereStartsWith for field ${field}:`, value);
    return [];
  }
  return await table.where(field).startsWith(value).toArray();
};

export const safeInsert = async (table: any, data: any) => {
  if (!isValidKey(data.id)) {
    // Fallback to a generated ID if missing
    data.id = crypto.randomUUID();
  }
  data.updatedAt = new Date().toISOString();
  return await table.put(data);
};

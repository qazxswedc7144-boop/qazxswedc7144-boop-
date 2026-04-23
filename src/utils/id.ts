
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function createEntity<T>(prefix: string, data: T): T & { id: string } {
  return {
    id: generateId(prefix),
    ...data
  }
}

export function ensureId<T extends { id?: string }>(data: T, prefix = 'entity'): T & { id: string } {
  if (!data.id) {
    data.id = generateId(prefix);
  }
  return data as T & { id: string };
}

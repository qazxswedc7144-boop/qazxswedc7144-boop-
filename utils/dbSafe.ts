export const isValid = (v: any) =>
  v !== undefined && v !== null && v !== ''

export const safeFirst = async (table: any, field: string, value: any) => {
  if (!isValid(value)) return null

  return await table.where(field).equals(value).first()
}

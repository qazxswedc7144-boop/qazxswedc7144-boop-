import { db } from '../services/database';

export const blockDirectDB = () => {
  // @ts-ignore
  const originalPut = db.db.products.put;
  // @ts-ignore
  db.db.products.put = () => {
    throw new Error("❌ ممنوع التعديل المباشر على المخزون");
  };
};

export const blockDexieErrors = () => {
  // @ts-ignore
  const originalWhere = db.db.products.where.bind(db.db.products);

  // @ts-ignore
  db.db.products.where = function(field: string) {
    const query = originalWhere(field);
    const originalEquals = query.equals.bind(query);

    query.equals = function(value: any) {
      console.log("🔍 WHERE:", field, value);
      if (value === undefined || value === null || value === "") {
        console.error("❌ INVALID KEY DETECTED", field, value);
        throw new Error("INVALID DEXIE KEY");
      }
      return originalEquals(value);
    };
    return query;
  };
};

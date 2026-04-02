
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  increment,
  Firestore,
  DocumentData,
  QueryConstraint,
  runTransaction
} from 'firebase/firestore';
import { db as firestore, auth } from './firebase';
import { authService } from './auth.service';
import { SyncableEntity } from '../types';

export class SyncEngine {
  private static listeners: (() => void)[] = [];
  private static syncStatus: 'syncing' | 'synced' | 'error' = 'synced';
  private static isOnline: boolean = navigator.onLine;

  static getStatus() {
    return this.syncStatus;
  }

  static getIsOnline() {
    return this.isOnline;
  }

  static initNetworkDetection(callback: (online: boolean) => void) {
    window.addEventListener('online', () => {
      this.isOnline = true;
      callback(true);
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      callback(false);
    });
  }

  /**
   * Get tenant ID for current user
   */
  static getTenantId(): string {
    return authService.getCurrentUser().tenant_id || 'TEN-DEV-001';
  }

  /**
   * Create a query with tenant isolation
   */
  static getTenantQuery(collectionName: string, ...constraints: QueryConstraint[]) {
    const tenantId = this.getTenantId();
    return query(
      collection(firestore, collectionName),
      where('tenant_id', '==', tenantId),
      ...constraints
    );
  }

  /**
   * Real-time listener with tenant isolation
   */
  static subscribe(collectionName: string, callback: (data: any[]) => void, ...constraints: QueryConstraint[]) {
    const q = this.getTenantQuery(collectionName, ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      console.error(`Error subscribing to ${collectionName}:`, error);
    });
    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Unsubscribe all listeners
   */
  static unsubscribeAll() {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
  }

  /**
   * Save document with versioning and tenant isolation
   */
  static async saveDoc(collectionName: string, id: string, data: any) {
    const tenantId = this.getTenantId();
    const docRef = doc(firestore, collectionName, id);
    
    const payload = {
      ...data,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
      version: increment(1),
      lastModified: new Date().toISOString(),
      syncVersion: increment(1)
    };

    await setDoc(docRef, payload, { merge: true });
  }

  /**
   * Batch write for atomic operations
   */
  static async executeBatch<T>(operations: (batch: any) => Promise<T>): Promise<T> {
    const batch = writeBatch(firestore);
    const result = await operations(batch);
    await batch.commit();
    return result;
  }

  static addToBatch(batch: any, collectionName: string, id: string, data: any) {
    const tenantId = this.getTenantId();
    const docRef = doc(firestore, collectionName, id);
    const payload = {
      ...data,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
      version: increment(1),
      lastModified: new Date().toISOString(),
      syncVersion: increment(1)
    };
    batch.set(docRef, payload, { merge: true });
  }

  /**
   * Conflict handling: Last Write Wins with Version Check
   */
  static async updateWithConflictCheck(collectionName: string, id: string, updateFn: (currentData: any) => any) {
    const docRef = doc(firestore, collectionName, id);
    
    await runTransaction(firestore, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw new Error("Document does not exist!");
      }

      const currentData = docSnap.data();
      const newData = updateFn(currentData);
      
      transaction.update(docRef, {
        ...newData,
        updated_at: new Date().toISOString(),
        version: increment(1),
        lastModified: new Date().toISOString(),
        syncVersion: increment(1)
      });
    });
  }
}

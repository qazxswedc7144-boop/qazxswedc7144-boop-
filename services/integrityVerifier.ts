
import { AccountingEntry } from '../types';
import { db } from './database';
import Dexie from 'dexie';

/**
 * Integrity Verifier - حارس نزاهة السجلات المالية
 */
export const integrityVerifier = {
  
  /**
   * توليد هاش فريد للقيد بناءً على بياناته وربطه بالقيد السابق
   */
  async generateEntryHash(entry: AccountingEntry, previousHash: string = "GENESIS"): Promise<string> {
    const dataToHash = JSON.stringify({
      id: entry.id,
      date: entry.date,
      total: entry.TotalAmount,
      lines: entry.lines.map(l => ({ a: l.accountId, d: l.debit, c: l.credit })).sort((a,b) => a.a.localeCompare(b.a)),
      prev: previousHash
    });

    const msgBuffer = new TextEncoder().encode(dataToHash);
    const hashBuffer = await Dexie.waitFor(crypto.subtle.digest('SHA-256', msgBuffer));
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * فحص شامل لكامل دفتر الأستاذ لاكتشاف أي تلاعب في السلسلة
   */
  // Fix: Made async and awaited db.getJournalEntries()
  async verifyChain(): Promise<{ isValid: boolean; corruptedEntryId?: string }> {
    const entries = await db.getJournalEntries();
    if (entries.length === 0) return { isValid: true };

    const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let lastHash = "GENESIS";

    for (const entry of sortedEntries) {
      if ((entry as any).hash) {
        const expectedHash = await this.generateEntryHash(entry, lastHash);
        if ((entry as any).hash !== expectedHash) {
          return { isValid: false, corruptedEntryId: entry.id };
        }
        lastHash = (entry as any).hash;
      } else {
        lastHash = await this.generateEntryHash(entry, lastHash);
      }
    }

    return { isValid: true };
  },

  /**
   * وسم القيد بالهاش قبل الحفظ النهائي لربطه بالقيد الذي يسبقه
   */
  // Fix: Made async and awaited db.getJournalEntries()
  async signEntry(entry: AccountingEntry): Promise<AccountingEntry> {
    const entries = await db.getJournalEntries();
    
    const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastEntry = sorted[sorted.length - 1];
    
    const prevHash = (lastEntry as any)?.hash || "GENESIS";
    const currentHash = await this.generateEntryHash(entry, prevHash);
    
    return { ...entry, hash: currentHash } as any;
  }
};

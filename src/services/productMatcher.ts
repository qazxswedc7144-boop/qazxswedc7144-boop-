
import { Product } from '../types';

/**
 * Normalizes a string for comparison by removing spaces and converting to lowercase.
 */
const normalize = (s: string) => s.toLowerCase().replace(/\s/g, '');

/**
 * Calculates the similarity between two strings (0 to 1).
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  let matches = 0;
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }

  return matches / maxLen;
}

/**
 * Tries to match an input product name with existing products.
 */
export function matchProductName(input: string, products: Product[]): Product | null {
  if (!input) return null;
  
  const normalizedInput = normalize(input);
  let bestMatch: Product | null = null;
  let bestScore = 0;

  products.forEach(p => {
    const score = similarity(normalizedInput, normalize(p.Name));

    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  });

  // Threshold for matching
  if (bestScore > 0.7) return bestMatch;

  return null;
}

/**
 * Normalizes Arabic text for better AI parsing.
 * - Replaces variations of Alef with a single form.
 * - Replaces Teh Marbuta with Heh.
 * - Replaces Alef Maksura with Yeh.
 * - Removes Tatweel (Kashida).
 * - Removes non-Arabic/English/numeric characters.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    // Keep Arabic letters, English letters, numbers, spaces, and dots
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s.]/g, '')
}

/**
 * Cleans text by removing extra whitespace.
 */
export function cleanInvoiceText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
}


const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export function saveOCRCache(hash: string, data: string) {
  localStorage.setItem(`ocr_cache_${hash}`, JSON.stringify({
    data,
    time: Date.now()
  }));
}

export function getOCRCache(hash: string): string | null {
  const item = localStorage.getItem(`ocr_cache_${hash}`);
  if (!item) return null;

  try {
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.time > CACHE_TTL) {
      localStorage.removeItem(`ocr_cache_${hash}`);
      return null;
    }
    return parsed.data;
  } catch (e) {
    return null;
  }
}

/**
 * Utility to construct the Gemini API key.
 * Note: The system automatically provides the API key via process.env.GEMINI_API_KEY.
 */
export function buildKey() {
  const part1 = "AIzaSy";
  const part2 = "XXXXXX";
  const part3 = "XXXXXX";

  return part1 + part2 + part3;
}

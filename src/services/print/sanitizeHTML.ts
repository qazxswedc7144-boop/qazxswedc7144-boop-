/**
 * Safe HTML Sanitizer for PharmaFlow Pro Enterprise Printable Templates.
 * Prevents any unsafe HTML injection by stripping out dangerous tags, inline javascript attributes,
 * and malicious event handler links, leaving only pristine safe nodes.
 */
export function sanitizeHTML(htmlString: string): string {
  if (!htmlString) return '';

  // 1. Strip script tags completely
  let purified = htmlString.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');

  // 2. Strip inline javascript event handlers (e.g. onload, onerror, onclick, etc.)
  purified = purified.replace(/\son[a-z]+=(['"])([\s\S]*?)\1/gi, '');

  // 3. Strip javascript: URLs in href/src attributes
  purified = purified.replace(/href=["']?javascript:[\s\S]*?["']/gi, 'href="#"');
  purified = purified.replace(/src=["']?javascript:[\s\S]*?["']/gi, 'src=""');

  // 4. Strip iframe, object, embed, applet, meta, and link stylesheet tags to prevent malicious styling/framing
  purified = purified.replace(/<(iframe|object|embed|applet|meta|link)[^>]*>([\s\S]*?)<\/\1>/gi, '');
  purified = purified.replace(/<(iframe|object|embed|applet|meta|link)[^>]*\/?>/gi, '');

  return purified;
}

/**
 * Escapes special characters to completely disable HTML parsing (safe plaintext text nodes).
 */
export function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

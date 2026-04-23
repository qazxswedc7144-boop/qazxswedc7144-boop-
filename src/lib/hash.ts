
export async function generateFileHash(file: File | string): Promise<string> {
  let buffer: ArrayBuffer;
  
  if (typeof file === 'string') {
    // It's a base64 string
    const base64 = file.split(',')[1] || file;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    buffer = bytes.buffer;
  } else {
    buffer = await file.arrayBuffer();
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

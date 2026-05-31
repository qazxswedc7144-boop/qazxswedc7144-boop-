
export async function calculateHash(data: any): Promise<string> {
  const str = JSON.stringify(data);
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function generateFileHash(file: File | string): Promise<string> {
  let arrayBuffer: ArrayBuffer;
  if (typeof file === 'string') {
    arrayBuffer = new TextEncoder().encode(file).buffer;
  } else {
    arrayBuffer = await file.arrayBuffer();
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';

function validateKey(keyHex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

export function encrypt(plaintext: string, keyHex: string): string {
  const key = validateKey(keyHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${Buffer.concat([encrypted, tag]).toString('hex')}`;
}

export function decrypt(stored: string, keyHex: string): string {
  const key = validateKey(keyHex);
  const parts = stored.split(':');
  const [ivHex, dataHex] = parts;
  // 12-byte IV + at least the 16-byte GCM tag, all hex
  if (
    parts.length !== 2 ||
    !/^[0-9a-f]{24}$/i.test(ivHex) ||
    !/^[0-9a-f]{32,}$/i.test(dataHex) ||
    dataHex.length % 2 !== 0
  ) {
    throw new Error('Malformed encrypted value: expected "<iv hex>:<ciphertext+tag hex>"');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto';

const VALID_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

describe('encrypt / decrypt', () => {
  it('encrypt returns a non-empty string with a colon separator', () => {
    const result = encrypt('hello', VALID_KEY);
    expect(result).toBeTruthy();
    expect(result).toContain(':');
  });

  it('decrypt round-trips back to the original plaintext', () => {
    const plaintext = 'super-secret-password';
    const encrypted = encrypt(plaintext, VALID_KEY);
    expect(decrypt(encrypted, VALID_KEY)).toBe(plaintext);
  });

  it('two encryptions of the same plaintext produce different output (random IV)', () => {
    const a = encrypt('same', VALID_KEY);
    const b = encrypt('same', VALID_KEY);
    expect(a).not.toBe(b);
  });

  it('decrypt with a wrong key throws', () => {
    const wrongKey = '1111111111111111111111111111111111111111111111111111111111111111';
    const encrypted = encrypt('secret', VALID_KEY);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('decrypt with tampered ciphertext throws (GCM auth tag check)', () => {
    const encrypted = encrypt('secret', VALID_KEY);
    const [iv, data] = encrypted.split(':');
    const tampered = `${iv}:${data.slice(0, -4)}ffff`;
    expect(() => decrypt(tampered, VALID_KEY)).toThrow();
  });

  it('accepts a valid 64-char hex key', () => {
    expect(() => encrypt('test', VALID_KEY)).not.toThrow();
  });

  it('throws when key is not 64 hex chars (too short)', () => {
    expect(() => encrypt('test', 'tooshort')).toThrow();
  });

  it('throws when key is not 64 hex chars (non-hex)', () => {
    const nonHex = 'z'.repeat(64);
    expect(() => encrypt('test', nonHex)).toThrow();
  });
});

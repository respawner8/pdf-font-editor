import { describe, it, expect } from 'vitest';
import { sha256Hex } from '@/shared/hash';

describe('sha256Hex', () => {
  it('hashes an empty buffer to the known value', async () => {
    const result = await sha256Hex(new ArrayBuffer(0));
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes ASCII "abc" to the known value', async () => {
    const buf = new TextEncoder().encode('abc').buffer;
    const result = await sha256Hex(buf);
    expect(result).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

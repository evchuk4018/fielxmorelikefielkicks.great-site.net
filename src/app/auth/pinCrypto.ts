import { PASSWORD_HASH_ITERATIONS } from '../constants';
import { UserProfile } from '../types';

const PIN_HASH_BYTES = 32;

function hexToBytes(value: string): Uint8Array | null {
  if (!value || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyAdminPin(profile: UserProfile, candidatePin: string): Promise<boolean> {
  if (profile.role !== 'admin' || profile.authType !== 'pin' || !profile.pinHash || !profile.pinSalt) {
    return false;
  }

  const saltBytes = hexToBytes(profile.pinSalt);
  const expectedHashBytes = hexToBytes(profile.pinHash);
  if (!saltBytes || !expectedHashBytes || expectedHashBytes.length !== PIN_HASH_BYTES) {
    return false;
  }

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(candidatePin), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    PIN_HASH_BYTES * 8,
  );

  const actualHashBytes = new Uint8Array(derived);
  if (actualHashBytes.length !== expectedHashBytes.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < actualHashBytes.length; index += 1) {
    difference |= actualHashBytes[index] ^ expectedHashBytes[index];
  }
  return difference === 0;
}

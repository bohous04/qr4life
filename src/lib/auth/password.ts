import { hash, verify } from '@node-rs/argon2';

/** Hashuje heslo algoritmem argon2id. */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Ověří heslo proti argon2 hashi. */
export function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  return verify(hashValue, password);
}

/*  Password lock: everything saved on the device is encrypted with a key derived from the
    user's password, so the data is unreadable without it — even to someone who reads this
    source code or copies the browser's storage.

    Key:     PBKDF2-SHA-256 (600k iterations, random 16-byte salt) → AES-GCM 256, non-extractable,
             held in memory only while unlocked.
    Records: AES-GCM with a random 12-byte IV per write.
    Check:   a known value sealed with the key; decrypting it proves the password is right.
    There is no recovery: a forgotten password means the saved data can't be read. */

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 10;
const CHECK_VALUE = "shaft-alignment-lock-v1";

/** Encrypted payload, base64 fields so it stores cleanly anywhere. */
export interface Sealed { iv: string; ct: string }

/** Stored in the clear: everything needed to re-derive the key and test a password. */
export interface LockMeta {
  id: "lock";
  v: 1;
  salt: string;
  iterations: number;
  check: Sealed;
  createdAt: string;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = random(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

/** Throws if the key is wrong or the data was tampered with. */
export async function unseal<T>(key: CryptoKey, s: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(s.iv) as BufferSource }, key, unb64(s.ct) as BufferSource);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export const isSealed = (v: unknown): v is Sealed =>
  typeof v === "object" && v !== null && typeof (v as Sealed).iv === "string" && typeof (v as Sealed).ct === "string";

/** New lock for a password: returns what to store plus the unlocked key. */
export async function createLock(password: string, iterations = KDF_ITERATIONS, now = new Date()): Promise<{ meta: LockMeta; key: CryptoKey }> {
  const salt = random(16);
  const key = await deriveKey(password, salt, iterations);
  const meta: LockMeta = { id: "lock", v: 1, salt: b64(salt), iterations, check: await seal(key, CHECK_VALUE), createdAt: now.toISOString() };
  return { meta, key };
}

/** The key if the password is right, otherwise null. */
export async function unlock(meta: LockMeta, password: string): Promise<CryptoKey | null> {
  const key = await deriveKey(password, unb64(meta.salt), meta.iterations);
  try {
    return (await unseal<string>(key, meta.check)) === CHECK_VALUE ? key : null;
  } catch {
    return null;
  }
}

/** Why a new password can't be used, or null if it's fine. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters — a few random words works well.`;
  if (/^(.)\1+$/.test(password)) return "That password is too easy to guess.";
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

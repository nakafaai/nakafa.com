import { VaultError } from "@repo/backend/confect/vault/schema";
import { Effect } from "effect";

/** The layout of a sealed value: this byte, the nonce, then ciphertext and tag. */
const FORMAT = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + NONCE_BYTES;
const KEY_BITS = 256;

const encoder = new TextEncoder();
const derivation = {
  hash: "SHA-256",
  name: "HKDF",
  salt: new Uint8Array(),
};

/** Runs one Web Crypto call; a failure becomes a secret-free error with `reason`. */
function run<Value>(
  reason: typeof VaultError.Type.reason,
  call: () => PromiseLike<Value>
) {
  return Effect.tryPromise({
    try: () => Promise.resolve(call()),
    catch: () => new VaultError({ reason }),
  });
}

/** Joins byte sequences into one buffer the Web Crypto API accepts. */
function join(parts: readonly Uint8Array[]) {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

/** The binding's length in four bytes, so a binding and a text never blur. */
function lengthOf(bytes: Uint8Array) {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, bytes.length);
  return length;
}

/**
 * Derives the two keys that seal with one 32-byte key: an AES-256-GCM key and
 * an HMAC key that makes each nonce. Neither can be exported again.
 */
export const deriveKeys = Effect.fn("vault.cipher.deriveKeys")(function* (
  key: Uint8Array
) {
  const base = yield* run("runtime", () =>
    crypto.subtle.importKey("raw", join([key]), "HKDF", false, ["deriveKey"])
  );
  const encrypt = yield* run("runtime", () =>
    crypto.subtle.deriveKey(
      { ...derivation, info: encoder.encode("nakafa/vault/seal/v1") },
      base,
      { length: KEY_BITS, name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    )
  );
  const nonce = yield* run("runtime", () =>
    crypto.subtle.deriveKey(
      { ...derivation, info: encoder.encode("nakafa/vault/nonce/v1") },
      base,
      { hash: "SHA-256", length: KEY_BITS, name: "HMAC" },
      false,
      ["sign"]
    )
  );
  return { encrypt, nonce };
});

type Keys = Effect.Success<ReturnType<typeof deriveKeys>>;

/**
 * Seals bytes for one binding with AES-256-GCM. The nonce is an HMAC of the
 * binding and the bytes under its own key: Convex may run a mutation again with
 * the same random seed, so a random nonce could repeat there, while this one
 * repeats only for the same binding and the same bytes. The binding is
 * authenticated with the ciphertext, so the value opens only under the same
 * binding. Two things stay visible in a sealed value: its length, and whether
 * two values under one key and one binding hold the same bytes.
 */
export const seal = Effect.fn("vault.cipher.seal")(function* (
  keys: Keys,
  binding: string,
  plain: Uint8Array
) {
  const bound = encoder.encode(binding);
  const mac = yield* run("runtime", () =>
    crypto.subtle.sign(
      "HMAC",
      keys.nonce,
      join([lengthOf(bound), bound, plain])
    )
  );
  const nonce = new Uint8Array(mac).slice(0, NONCE_BYTES);
  const sealed = yield* run("runtime", () =>
    crypto.subtle.encrypt(
      { additionalData: bound, iv: nonce, name: "AES-GCM" },
      keys.encrypt,
      join([plain])
    )
  );
  return join([Uint8Array.of(FORMAT), nonce, new Uint8Array(sealed)]).buffer;
});

/** Opens a sealed value. It fails when the format, the binding, the key or any byte differs. */
export const open = Effect.fn("vault.cipher.open")(function* (
  keys: Keys,
  binding: string,
  sealed: ArrayBuffer
) {
  const bytes = new Uint8Array(sealed);
  if (bytes[0] !== FORMAT || bytes.length < HEADER_BYTES + TAG_BYTES) {
    return yield* new VaultError({ reason: "cipher" });
  }
  const plain = yield* run("cipher", () =>
    crypto.subtle.decrypt(
      {
        additionalData: encoder.encode(binding),
        iv: bytes.slice(1, HEADER_BYTES),
        name: "AES-GCM",
      },
      keys.encrypt,
      bytes.slice(HEADER_BYTES)
    )
  );
  return new Uint8Array(plain);
});

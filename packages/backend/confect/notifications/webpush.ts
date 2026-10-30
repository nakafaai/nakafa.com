import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Duration,
  Effect,
  Redacted,
  Schema,
} from "effect";
import { SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";
import { HttpClient, HttpClientRequest } from "effect/http";

const encoder = new TextEncoder();

/** The record size an aes128gcm body declares: one record holds the whole notice (RFC 8188). */
const RECORD_SIZE = 4096;

/** How long a push service keeps an undelivered notice: one day, since the inbox holds it anyway. */
const TIME_TO_LIVE_SECONDS = 86_400;

/** How long a VAPID token stays valid; RFC 8292 allows at most 24 hours. */
const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;

/** The deadline of one push request (ADR 0020). */
const PUSH_DEADLINE = Duration.seconds(10);

/** One push subscription of a browser: the push service's endpoint and the browser's keys, Base64Url. */
export const PushTarget = Schema.Struct({
  auth: Schema.String,
  endpoint: Schema.String,
  p256dh: Schema.String,
});

/** The application server's VAPID keys: the public key and the private scalar, Base64Url, and its contact. */
const VapidKeys = Schema.Struct({
  privateKey: Schema.Redacted(Schema.String),
  publicKey: Schema.String,
  subject: Schema.String,
});

/** A push that failed: a key that does not decode, a crypto step, or a push service that refused or never answered. */
export class PushFailed extends Schema.TaggedError<PushFailed>()("PushFailed", {
  reason: Schema.Literals(["key", "crypto", "unreached", "refused"]),
  status: Schema.optionalKey(Schema.Int),
}) {}

/** Runs one Web Crypto call; a failure is a crypto failure, with no secret in it. */
const subtle = <A>(call: () => PromiseLike<A>) =>
  Effect.tryPromise({
    catch: () => new PushFailed({ reason: "crypto" }),
    try: () => Promise.resolve(call()),
  });

/** The bytes of a Base64Url text, or a key failure. */
const bytesOf = (text: string) =>
  Effect.fromResult(Base64Url.decode(text)).pipe(
    Effect.map((bytes) => new Uint8Array(bytes)),
    Effect.mapError(() => new PushFailed({ reason: "key" }))
  );

/** Joins byte sequences into one. */
const join = (parts: readonly Uint8Array[]) => {
  const joined = new Uint8Array(
    Arr.reduce(parts, 0, (sum, part) => sum + part.length)
  );
  Arr.reduce(parts, 0, (offset, part) => {
    joined.set(part, offset);
    return offset + part.length;
  });
  return joined;
};

/** HMAC-SHA-256 of `data` under the raw key `key`, the extract and expand step of HKDF (RFC 5869). */
const hmac = Effect.fn("notifications.webpush.hmac")(function* (
  key: Uint8Array<ArrayBuffer>,
  data: Uint8Array<ArrayBuffer>
) {
  const imported = yield* subtle(() =>
    crypto.subtle.importKey(
      "raw",
      key,
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"]
    )
  );
  return new Uint8Array(
    yield* subtle(() => crypto.subtle.sign("HMAC", imported, data))
  );
});

/**
 * Encrypts one notice for one browser as RFC 8291 asks: an ECDH key agreement
 * with the browser's key and a fresh key pair, keyed by the browser's auth
 * secret, then one aes128gcm record (RFC 8188) whose header carries the salt,
 * the record size and the fresh public key.
 */
export const encryptPayload = Effect.fn("notifications.webpush.encrypt")(
  function* (target: typeof PushTarget.Type, payload: Uint8Array) {
    const browserKey = yield* bytesOf(target.p256dh);
    const authSecret = yield* bytesOf(target.auth);
    const pair = yield* subtle(() =>
      crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
        "deriveBits",
      ])
    );
    const serverKey = new Uint8Array(
      yield* subtle(() => crypto.subtle.exportKey("raw", pair.publicKey))
    );
    const browserPublic = yield* subtle(() =>
      crypto.subtle.importKey(
        "raw",
        browserKey,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      )
    );
    const shared = new Uint8Array(
      yield* subtle(() =>
        crypto.subtle.deriveBits(
          { name: "ECDH", public: browserPublic },
          pair.privateKey,
          256
        )
      )
    );
    const pseudoKey = yield* hmac(authSecret, shared);
    const keyMaterial = yield* hmac(
      pseudoKey,
      join([
        encoder.encode("WebPush: info\0"),
        browserKey,
        serverKey,
        new Uint8Array([1]),
      ])
    );
    // A random source that fails is a defect of the runtime, not of the push.
    const salt = new Uint8Array(
      yield* (yield* SecureRandom.SecureRandom).randomBytes(16)
    );
    const pseudo = yield* hmac(salt, keyMaterial);
    const contentKey = (yield* hmac(
      pseudo,
      join([
        encoder.encode("Content-Encoding: aes128gcm\0"),
        new Uint8Array([1]),
      ])
    )).slice(0, 16);
    const nonce = (yield* hmac(
      pseudo,
      join([encoder.encode("Content-Encoding: nonce\0"), new Uint8Array([1])])
    )).slice(0, 12);
    const aesKey = yield* subtle(() =>
      crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"])
    );
    const sealed = new Uint8Array(
      yield* subtle(() =>
        crypto.subtle.encrypt(
          { iv: nonce, name: "AES-GCM" },
          aesKey,
          join([payload, new Uint8Array([2])])
        )
      )
    );
    const header = new Uint8Array(21);
    header.set(salt, 0);
    new DataView(header.buffer).setUint32(16, RECORD_SIZE);
    header[20] = serverKey.length;
    return join([header, serverKey, sealed]);
  },
  Effect.provide(SecureRandom.layerWebCrypto)
);

/**
 * The VAPID token of one push request (RFC 8292): a JWT signed with ES256 by the
 * application server's private key, for the origin of the push service, valid
 * for 12 hours.
 */
export const vapidToken = Effect.fn("notifications.webpush.vapid")(function* (
  endpoint: string,
  keys: typeof VapidKeys.Type,
  nowSeconds: number
) {
  const publicKey = yield* bytesOf(keys.publicKey);
  const audience = yield* Effect.try({
    catch: () => new PushFailed({ reason: "key" }),
    try: () => new URL(endpoint).origin,
  });
  const signingKey = yield* subtle(() =>
    crypto.subtle.importKey(
      "jwk",
      {
        crv: "P-256",
        d: Redacted.value(keys.privateKey),
        ext: false,
        kty: "EC",
        x: Base64Url.encode(publicKey.slice(1, 33)),
        y: Base64Url.encode(publicKey.slice(33, 65)),
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    )
  );
  const unsigned = `${Base64Url.encode(
    encoder.encode(encodeJsonText({ alg: "ES256", typ: "JWT" }))
  )}.${Base64Url.encode(
    encoder.encode(
      encodeJsonText({
        aud: audience,
        exp: nowSeconds + TOKEN_LIFETIME_SECONDS,
        sub: keys.subject,
      })
    )
  )}`;
  const signature = new Uint8Array(
    yield* subtle(() =>
      crypto.subtle.sign(
        { hash: "SHA-256", name: "ECDSA" },
        signingKey,
        encoder.encode(unsigned)
      )
    )
  );
  return `${unsigned}.${Base64Url.encode(signature)}`;
});

/**
 * Sends one notice to one browser. A push is a write that must not repeat (ADR
 * 0027), so it is sent once, with its own deadline, and never asked again. Only
 * a 2xx answer delivers it; 404 and 410 say the subscription is gone, so the
 * caller forgets it; any other answer, or none, fails the push, and the inbox
 * still holds the notice.
 */
export const sendPush = Effect.fn("notifications.webpush.send")(function* (
  target: typeof PushTarget.Type,
  payload: string,
  keys: typeof VapidKeys.Type,
  nowSeconds: number
) {
  const body = yield* encryptPayload(target, encoder.encode(payload));
  const token = yield* vapidToken(target.endpoint, keys, nowSeconds);
  const response = yield* (yield* HttpClient.HttpClient)
    .execute(
      HttpClientRequest.post(target.endpoint).pipe(
        HttpClientRequest.setHeaders({
          authorization: `vapid t=${token}, k=${keys.publicKey}`,
          "content-encoding": "aes128gcm",
          ttl: String(TIME_TO_LIVE_SECONDS),
          urgency: "normal",
        }),
        HttpClientRequest.bodyUint8Array(body, "application/octet-stream")
      )
    )
    .pipe(
      Effect.timeout(PUSH_DEADLINE),
      Effect.mapError(() => new PushFailed({ reason: "unreached" })),
      Effect.scoped
    );
  if (response.status === 404 || response.status === 410) {
    return "gone" as const;
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* new PushFailed({
      reason: "refused",
      status: response.status,
    });
  }
  return "delivered" as const;
});

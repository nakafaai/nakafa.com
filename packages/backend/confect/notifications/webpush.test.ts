import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  encryptPayload,
  sendPush,
  vapidToken,
} from "@repo/backend/confect/notifications/webpush";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Redacted, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The bytes of a Base64Url text the test wrote itself. */
const bytes = (text: string) => {
  const decoded = Base64Url.decode(text);
  if (decoded._tag === "Failure") {
    throw new Error("The test's own key does not decode.");
  }
  return decoded.success;
};

/** Joins byte sequences, as the receiving browser does. */
const join = (parts: readonly Uint8Array[]) => {
  const joined = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0)
  );
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
};

/** HMAC-SHA-256, as the receiving browser computes it. */
const hmac = async (key: Uint8Array, data: Uint8Array) =>
  new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        key,
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"]
      ),
      data
    )
  );

/** A browser's push subscription: its ECDH key pair and its auth secret. */
const browserOf = async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey)
  );
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    auth,
    pair,
    publicKey,
    target: {
      auth: Base64Url.encode(auth),
      endpoint: "https://push.example.test/send/abc",
      p256dh: Base64Url.encode(publicKey),
    },
  };
};

/** Decrypts one aes128gcm body as the browser does (RFC 8291 and RFC 8188). */
const decrypt = async (
  browser: Awaited<ReturnType<typeof browserOf>>,
  body: Uint8Array
) => {
  const salt = body.slice(0, 16);
  const keyLength = body[20] ?? 0;
  const serverKey = body.slice(21, 21 + keyLength);
  const sealed = body.slice(21 + keyLength);
  const server = await crypto.subtle.importKey(
    "raw",
    serverKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: server },
      browser.pair.privateKey,
      256
    )
  );
  const pseudoKey = await hmac(browser.auth, shared);
  const material = await hmac(
    pseudoKey,
    join([
      encoder.encode("WebPush: info\0"),
      browser.publicKey,
      serverKey,
      new Uint8Array([1]),
    ])
  );
  const pseudo = await hmac(salt, material);
  const key = (
    await hmac(
      pseudo,
      join([encoder.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])])
    )
  ).slice(0, 16);
  const nonce = (
    await hmac(
      pseudo,
      join([encoder.encode("Content-Encoding: nonce\0"), new Uint8Array([1])])
    )
  ).slice(0, 12);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { iv: nonce, name: "AES-GCM" },
      await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]),
      sealed
    )
  );
  return {
    recordSize: new DataView(body.buffer, body.byteOffset).getUint32(16),
    text: decoder.decode(plain.slice(0, -1)),
    trailer: plain.at(-1),
  };
};

/** A VAPID key pair as an operator stores it: the public point and the private scalar, Base64Url. */
const vapidOf = async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", pair.publicKey)
  );
  return {
    keys: {
      privateKey: Redacted.make(jwk.d ?? ""),
      publicKey: Base64Url.encode(publicKey),
      subject: "mailto:halo@nakafa.com",
    },
    pair,
  };
};

const Claims = Schema.fromJsonString(
  Schema.Struct({ aud: Schema.String, exp: Schema.Finite, sub: Schema.String })
);

describe("notifications/webpush", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "encrypts a notice that only the subscribed browser opens, in one aes128gcm record",
    () =>
      Effect.gen(function* () {
        const browser = yield* Effect.promise(browserOf);
        const body = yield* encryptPayload(
          browser.target,
          encoder.encode('{"id":"n1","title":"Nakafa"}')
        );
        const opened = yield* Effect.promise(() => decrypt(browser, body));
        expect(opened).toEqual({
          recordSize: 4096,
          text: '{"id":"n1","title":"Nakafa"}',
          trailer: 2,
        });
        const refused = yield* encryptPayload(
          { ...browser.target, p256dh: "not a key!" },
          encoder.encode("x")
        ).pipe(Effect.flip);
        expect(refused).toMatchObject({ reason: "key" });
        const broken = yield* encryptPayload(
          { ...browser.target, p256dh: Base64Url.encode(new Uint8Array(3)) },
          encoder.encode("x")
        ).pipe(Effect.flip);
        expect(broken).toMatchObject({ reason: "crypto" });
      })
  );

  it.effect(
    "signs a VAPID token for the push service's origin that the public key verifies",
    () =>
      Effect.gen(function* () {
        const vapid = yield* Effect.promise(vapidOf);
        const token = yield* vapidToken(
          "https://push.example.test/send/abc",
          vapid.keys,
          1000
        );
        const [header = "", claims = "", signature = ""] = token.split(".");
        const verified = yield* Effect.promise(() =>
          crypto.subtle.verify(
            { hash: "SHA-256", name: "ECDSA" },
            vapid.pair.publicKey,
            bytes(signature),
            encoder.encode(`${header}.${claims}`)
          )
        );
        expect(verified).toBe(true);
        expect(
          yield* Schema.decodeEffect(Claims)(decoder.decode(bytes(claims)))
        ).toEqual({
          aud: "https://push.example.test",
          exp: 1000 + 12 * 60 * 60,
          sub: "mailto:halo@nakafa.com",
        });
        const refused = yield* vapidToken("not a url", vapid.keys, 1).pipe(
          Effect.flip
        );
        expect(refused).toMatchObject({ reason: "key" });
      })
  );

  it.effect(
    "delivers on a 2xx answer, forgets a gone subscription, and fails on any other answer or none",
    () =>
      Effect.gen(function* () {
        const browser = yield* Effect.promise(browserOf);
        const vapid = yield* Effect.promise(vapidOf);
        const push = () =>
          sendPush(browser.target, "{}", vapid.keys, 1000).pipe(
            Effect.provide(FetchClient),
            Effect.provideService(FetchHttpClient.Fetch, fetcher)
          );
        fetcher.mockResolvedValueOnce(new Response(null, { status: 201 }));
        expect(yield* push()).toBe("delivered");
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(String(url)).toBe("https://push.example.test/send/abc");
        expect(new Headers(init?.headers).get("content-encoding")).toBe(
          "aes128gcm"
        );
        expect(new Headers(init?.headers).get("authorization")).toMatch(
          /^vapid t=.+, k=/u
        );
        fetcher.mockResolvedValueOnce(new Response(null, { status: 410 }));
        expect(yield* push()).toBe("gone");
        fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
        expect(yield* push()).toBe("gone");
        fetcher.mockResolvedValueOnce(new Response(null, { status: 429 }));
        expect(yield* push().pipe(Effect.flip)).toMatchObject({
          reason: "refused",
          status: 429,
        });
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));
        expect(yield* push().pipe(Effect.flip)).toMatchObject({
          reason: "unreached",
        });
      })
  );
});

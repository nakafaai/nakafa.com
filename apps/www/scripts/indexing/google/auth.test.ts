// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Clock,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Path,
  PlatformError,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { getGoogleAccessToken } from "@/scripts/indexing/google/auth";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const CLIENT_EMAIL = "indexer@nakafa-test.invalid";
const JwtHeaderSchema = Schema.fromJsonString(
  Schema.Struct({ alg: Schema.String, typ: Schema.String })
);
const JwtClaimsSchema = Schema.fromJsonString(
  Schema.Struct({
    aud: Schema.String,
    exp: Schema.Number,
    iat: Schema.Number,
    iss: Schema.String,
    scope: Schema.String,
  })
);
/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

/**
 * Makes a throwaway RSA key pair in memory. Its key file text is handed to the
 * module as a file read; nothing is written to disk.
 */
async function createThrowawayKey() {
  const pair = await crypto.subtle.generateKey(
    {
      hash: "SHA-256",
      modulusLength: 2048,
      name: "RSASSA-PKCS1-v1_5",
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"]
  );
  const keyBody = Buffer.from(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey)
  ).toString("base64");
  return {
    keyBody,
    keyFile: encodeJsonText({
      client_email: CLIENT_EMAIL,
      private_key: `-----BEGIN PRIVATE KEY-----\n${keyBody}\n-----END PRIVATE KEY-----\n`,
    }),
    publicKey: pair.publicKey,
  };
}
const throwawayKey = createThrowawayKey();

beforeEach(() => {
  fetcher.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** The real path service beside a file system scripted for one test. */
const scriptedFiles = (fileSystem: Partial<FileSystem.FileSystem>) =>
  Layer.merge(Path.layer, FileSystem.layerNoop(fileSystem));

/** Requests a token through the module's own client, this file's fetch double, and a scripted file system. */
function requestTokenWith(files: Partial<FileSystem.FileSystem>) {
  return getGoogleAccessToken().pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher),
    Effect.provide(scriptedFiles(files))
  );
}

/** Requests a token with one key file, read as text. */
function requestToken(keyFile: string) {
  return requestTokenWith({ readFileString: () => Effect.succeed(keyFile) });
}

/** The signed assertion that the token request posted in its form body. */
function postedAssertion() {
  return (
    new URLSearchParams(String(fetcher.mock.calls[0]?.[1]?.body)).get(
      "assertion"
    ) ?? ""
  );
}

/** Decodes one base64url segment of a JWT into its JSON text. */
const decodeSegment = (segment: string) =>
  Buffer.from(segment, "base64url").toString("utf8");

/** A 200 answer whose body starts and never ends, so the read waits for its deadline. */
const neverEndingBody = () =>
  new Response(new ReadableStream({ start: () => undefined }), { status: 200 });

/** A 200 answer whose body fails while it is read. */
const brokenBody = () =>
  new Response(
    new ReadableStream({
      pull(controller) {
        controller.error(new Error("body interrupted"));
      },
    }),
    { status: 200 }
  );

describe("getGoogleAccessToken", () => {
  it.effect(
    "posts one signed assertion as a form body and returns the access token",
    () =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
        fetcher.mockResolvedValueOnce(
          Response.json({ access_token: "token-value" })
        );

        expect(yield* requestToken(key.keyFile)).toBe("token-value");

        expect(fetcher).toHaveBeenCalledOnce();
        const [input, init] = fetcher.mock.calls[0] ?? [];
        expect(String(input)).toBe(TOKEN_ENDPOINT);
        expect(init?.method).toBe("POST");
        const form = new URLSearchParams(String(init?.body));
        expect(form.get("grant_type")).toBe(GRANT_TYPE);
        const assertion = form.get("assertion") ?? "";
        expect(assertion.split(".")).toHaveLength(3);
        const [header = "", claims = "", signature = ""] = assertion.split(".");
        expect(
          Schema.decodeSync(JwtHeaderSchema)(decodeSegment(header))
        ).toEqual({ alg: "RS256", typ: "JWT" });
        expect(
          Schema.decodeSync(JwtClaimsSchema)(decodeSegment(claims))
        ).toEqual({
          aud: TOKEN_ENDPOINT,
          exp: now + 3600,
          iat: now,
          iss: CLIENT_EMAIL,
          scope: INDEXING_SCOPE,
        });
        const signedInput = new TextEncoder().encode(`${header}.${claims}`);
        expect(
          yield* Effect.promise(() =>
            crypto.subtle.verify(
              "RSASSA-PKCS1-v1_5",
              key.publicKey,
              new Uint8Array(Buffer.from(signature, "base64url")),
              signedInput
            )
          )
        ).toBe(true);
      })
  );

  it.effect(
    "fails with a deadline when the token body never ends, at 10 s",
    () =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        fetcher.mockResolvedValueOnce(neverEndingBody());
        const fiber = yield* Effect.forkChild(
          requestToken(key.keyFile).pipe(Effect.flip)
        );
        // Signing uses real Web Crypto, so the request starts after the clock is idle.
        yield* Effect.promise(() =>
          vi.waitFor(
            () => {
              expect(fetcher).toHaveBeenCalledOnce();
            },
            { timeout: 4000 }
          )
        );

        yield* TestClock.adjust("10 seconds");

        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "GoogleTokenRequestError",
          cause: "deadline",
          message: "Google token request did not answer within 10 seconds.",
        });
      })
  );

  it.effect(
    "fails with a transport error when the token request is rejected",
    () =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

        expect(
          yield* requestToken(key.keyFile).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "GoogleTokenRequestError",
          message: "Google token request transport failed.",
        });
      })
  );

  it.effect.each([401, 403, 500])(
    "fails with the refusal when the token endpoint answers %i",
    (status) =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        fetcher.mockResolvedValueOnce(new Response("refused", { status }));

        expect(
          yield* requestToken(key.keyFile).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "GoogleTokenRequestError",
          message: "Google token request failed.",
        });
      })
  );

  it.effect("fails with a typed error when the token body cannot be read", () =>
    Effect.gen(function* () {
      const key = yield* Effect.promise(() => throwawayKey);
      fetcher.mockResolvedValueOnce(brokenBody());

      expect(yield* requestToken(key.keyFile).pipe(Effect.flip)).toMatchObject({
        _tag: "GoogleTokenRequestError",
        message: "Google token response could not be read.",
      });
    })
  );

  it.effect.each([
    { body: "not json response-body-marker", label: "is not JSON" },
    {
      body: encodeJsonText({
        note: "response-body-marker",
        token_type: "Bearer",
      }),
      label: "has no access token",
    },
  ])(
    "maps a 2xx token answer that $label to a malformed-answer error without its text",
    ({ body }) =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        fetcher.mockResolvedValueOnce(new Response(body, { status: 200 }));

        const error = yield* requestToken(key.keyFile).pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "GoogleTokenRequestError",
          cause: "malformed",
        });
        expect(String(error)).not.toContain("response-body-marker");
      })
  );

  it.effect(
    "prints a refused token request as its tag and fixed message, without the body, assertion, or key",
    () =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        fetcher.mockResolvedValueOnce(
          new Response("response-body-marker", { status: 401 })
        );

        const error = yield* requestToken(key.keyFile).pipe(Effect.flip);

        const assertion = postedAssertion();
        expect(assertion.split(".")).toHaveLength(3);
        // The entry points print `${error}`, which is the tag and the message.
        const printed = String(error);
        expect(printed).toBe(
          "GoogleTokenRequestError: Google token request failed."
        );
        expect(printed).not.toContain("response-body-marker");
        expect(printed).not.toContain(assertion);
        expect(printed).not.toContain(key.keyBody);
      })
  );

  it.effect(
    "prints a failed token transport as its tag and fixed message, without the assertion",
    () =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

        const error = yield* requestToken(key.keyFile).pipe(Effect.flip);

        const assertion = postedAssertion();
        expect(assertion.split(".")).toHaveLength(3);
        const printed = String(error);
        expect(printed).toBe(
          "GoogleTokenRequestError: Google token request transport failed."
        );
        expect(printed).not.toContain(assertion);
        expect(printed).not.toContain(key.keyBody);
      })
  );

  it.effect(
    "fails with GoogleAssertionSignError when the key file is missing",
    () =>
      Effect.gen(function* () {
        expect(
          yield* requestTokenWith({
            readFileString: () =>
              Effect.fail(
                PlatformError.systemError({
                  _tag: "NotFound",
                  module: "FileSystem",
                  method: "readFileString",
                })
              ),
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "GoogleAssertionSignError",
          message: expect.stringContaining("Failed to read"),
        });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    { body: "not json", label: "is not JSON" },
    {
      body: encodeJsonText({ client_email: CLIENT_EMAIL }),
      label: "has no private key",
    },
    {
      body: encodeJsonText({ client_email: "", private_key: "unused" }),
      label: "has an empty client email",
    },
  ])("rejects a key file that $label", ({ body }) =>
    Effect.gen(function* () {
      expect(yield* requestToken(body).pipe(Effect.flip)).toMatchObject({
        _tag: "GoogleAssertionSignError",
        message:
          "Google service-account credentials must include client_email and private_key.",
      });
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects a private key that Web Crypto cannot import", () =>
    Effect.gen(function* () {
      const keyFile = encodeJsonText({
        client_email: CLIENT_EMAIL,
        private_key:
          "-----BEGIN PRIVATE KEY-----\nbm90LWEta2V5\n-----END PRIVATE KEY-----\n",
      });

      expect(yield* requestToken(keyFile).pipe(Effect.flip)).toMatchObject({
        _tag: "GoogleAssertionSignError",
        message: "Failed to import the Google service-account private key.",
      });
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "fails with GoogleAssertionSignError when Web Crypto refuses to sign",
    () =>
      Effect.gen(function* () {
        const key = yield* Effect.promise(() => throwawayKey);
        vi.spyOn(crypto.subtle, "sign").mockRejectedValueOnce(
          new Error("sign refused")
        );

        expect(
          yield* requestToken(key.keyFile).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "GoogleAssertionSignError",
          message: "Failed to sign the Google service-account JWT assertion.",
        });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );
});

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import {
  AuthSession,
  followAuthSession,
  holdSession,
  previewAuthSession,
  readClientSession,
  releaseSession,
} from "@/lib/auth/session";

/** The JSON text of one body. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** An access token of `session-1`. */
const TOKEN = Arr.join(
  [
    Base64Url.encode(encodeJson({ alg: "ES256" })),
    Base64Url.encode(encodeJson({ exp: 4_102_444_800, sub: "session-1" })),
    "signature",
  ],
  "."
);

const ADA = { sessionId: "session-1", userId: "user-1" };

const signedIn = AuthSession.make({
  hasError: false,
  isPending: false,
  sessionId: "session-1",
  userId: "user-1",
});

const pending = AuthSession.make({
  hasError: false,
  isPending: true,
  sessionId: null,
  userId: null,
});

describe("readClientSession", () => {
  it("reads the session the token names, with the account its answer named", () => {
    expect(
      readClientSession(
        { hasError: false, isLoading: false, token: TOKEN },
        ADA
      )
    ).toEqual(signedIn);
  });

  it("names no account that an answer gave for another session", () => {
    expect(
      readClientSession(
        { hasError: false, isLoading: false, token: TOKEN },
        { sessionId: "other", userId: "user-2" }
      ).userId
    ).toBeNull();
    expect(
      readClientSession(
        { hasError: false, isLoading: false, token: TOKEN },
        null
      ).userId
    ).toBeNull();
  });

  it("reads a client without a readable token as no session, pending while it loads", () => {
    expect(
      readClientSession({ hasError: false, isLoading: true, token: null }, ADA)
    ).toEqual(pending);
    expect(
      readClientSession(
        { hasError: true, isLoading: false, token: "not-a-token" },
        ADA
      )
    ).toEqual({ ...previewAuthSession, hasError: true });
  });
});

describe("followAuthSession", () => {
  it("takes the session the client settles on", () => {
    expect(followAuthSession(pending, signedIn)).toBe(signedIn);
    expect(followAuthSession(signedIn, previewAuthSession)).toBe(
      previewAuthSession
    );
  });

  it("keeps the session readers see through a failed read, marked with the error", () => {
    const failed = { ...previewAuthSession, hasError: true };

    expect(followAuthSession(signedIn, failed)).toEqual({
      ...signedIn,
      hasError: true,
    });
    expect(followAuthSession(pending, failed)).toEqual({
      ...pending,
      hasError: true,
    });
  });

  it.effect(
    "keeps the session readers see while the page signs out, and follows again once the sign-out failed",
    () =>
      Effect.gen(function* () {
        yield* holdSession();
        expect(followAuthSession(signedIn, previewAuthSession)).toBe(signedIn);

        yield* releaseSession();
        expect(followAuthSession(signedIn, previewAuthSession)).toBe(
          previewAuthSession
        );
      })
  );
});

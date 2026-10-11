import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { TOKEN_PAGE_SIZE } from "@repo/backend/confect/auth/tokens.impl";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  cookieHeader,
  createGoogleIdToken,
  GOOGLE_KEY,
  signInWithGoogle,
} from "@repo/backend/test/auth";
import { encodeJsonText } from "@repo/utilities/json";
import {
  formatEnvelope,
  parseEnvelope,
  symmetricDecrypt,
  symmetricEncrypt,
} from "better-auth/crypto";
import { Array as Arr, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 8, 4, 10, 30, 0);
const SECRET = "synthetic-better-auth-secret-for-token-tests";
const ROTATED = "synthetic-rotated-secret-for-the-token-tests";
const LEGACY_ACCESS = "ya29.legacy-access-token";
const LEGACY_REFRESH = "1//legacy-refresh-token";
const NOT_BLANK = /\S/;
/** Better Auth asks Google for its signing keys through `fetch` to check an ID token. */
const keyLookup = vi.fn<typeof fetch>();
const encrypt = refs.internal.auth.tokens.encryptStoredTokens;
const StoredAccount = Schema.Struct({
  _id: Schema.String,
  accessToken: Schema.optionalKey(Schema.NullOr(Schema.String)),
  accountId: Schema.String,
  refreshToken: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
const AccessTokenBody = Schema.fromJsonString(
  Schema.Struct({ accessToken: Schema.String })
);
type TestConvex = ReturnType<typeof createConvexTestWithBetterAuth>;
type Seed = Pick<
  typeof StoredAccount.Type,
  "accessToken" | "accountId" | "refreshToken"
>;

/** Every stored account row, in creation order. */
const accounts = Effect.fn("test.auth.tokens.accounts")(function* (
  test: TestConvex
) {
  const result = yield* Effect.promise(() =>
    test.query((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "account",
        paginationOpts: { cursor: null, numItems: TOKEN_PAGE_SIZE * 2 },
      })
    )
  );
  return yield* Schema.decodeUnknownEffect(Schema.Array(StoredAccount))(
    result.page
  );
});

/** Stores one account row with exactly the given token columns. */
const seed = Effect.fn("test.auth.tokens.seed")(function* (
  test: TestConvex,
  { accountId, ...tokens }: Seed
) {
  yield* Effect.promise(() =>
    test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          data: {
            accountId,
            createdAt: NOW,
            providerId: "google",
            updatedAt: NOW,
            userId: `user-${accountId}`,
            ...tokens,
          },
          model: "account",
        },
      })
    )
  );
});

/** Calls the function once, as an operator would, and decodes what it returns. */
const call = Effect.fn("test.auth.tokens.call")(function* (
  test: TestConvex,
  cursor: string | null
) {
  const returns = yield* Effect.promise(() =>
    test.mutation(Ref.getFunctionReference(encrypt), { cursor })
  );
  return yield* Ref.decodeReturns(encrypt, returns);
});

type Page = Effect.Success<ReturnType<typeof call>>;

/** Calls the function with each `continueCursor` until it reports `isDone`. */
const pass = Effect.fn("test.auth.tokens.pass")(function* (test: TestConvex) {
  let cursor: string | null = null;
  let pages = Arr.empty<Page>();
  while (true) {
    const page: Page = yield* call(test, cursor);
    pages = Arr.append(pages, page);
    if (page.isDone) {
      return pages;
    }
    cursor = page.continueCursor;
  }
});

/** The plain text behind a token that Better Auth encrypted. */
const unseal = Effect.fn("test.auth.tokens.unseal")(function* (
  token: string | null | undefined
) {
  const sealed = yield* Effect.fromNullishOr(token).pipe(Effect.orDie);
  return yield* Effect.promise(() =>
    symmetricDecrypt({ data: sealed, key: SECRET })
  );
});

/**
 * Signs a learner in, then writes the plain tokens that an older deployment
 * stored for the same row, and returns the cookies of the session.
 */
const legacyLearner = Effect.fn("test.auth.tokens.legacyLearner")(function* (
  test: TestConvex,
  suffix: string
) {
  const response = yield* Effect.promise(() =>
    signInWithGoogle(test, suffix, NOW)
  );
  const [row] = yield* accounts(test);
  yield* Effect.promise(() =>
    test.mutation((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "account",
          update: { accessToken: LEGACY_ACCESS, refreshToken: LEGACY_REFRESH },
          where: [{ field: "_id", operator: "eq", value: row._id }],
        },
      })
    )
  );
  return cookieHeader(response);
});

/** Better Auth's own token route, which decrypts the stored access token. */
const readAccessToken = Effect.fn("test.auth.tokens.readAccessToken")(
  function* (test: TestConvex, cookie: string) {
    const response = yield* Effect.promise(() =>
      test.fetch("/api/auth/get-access-token", {
        body: encodeJsonText({ providerId: "google" }),
        headers: {
          "content-type": "application/json",
          cookie,
          origin: "http://localhost:3000",
        },
        method: "POST",
      })
    );
    expect(response.status).toBe(200);
    const body = yield* Effect.promise(() => response.text());
    const decoded = yield* Schema.decodeEffect(AccessTokenBody)(body);
    return decoded.accessToken;
  }
);

beforeEach(() => {
  // Faked timers keep the sign-in's scheduled customer sync from running.
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("auth/tokens", () => {
  it.effect(
    "seals plain tokens so that Better Auth reads them back, and a second pass changes nothing",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const cookie = yield* legacyLearner(test, "readback");

        expect(yield* pass(test)).toMatchObject([
          { encrypted: 1, isDone: true, scanned: 1, unreadable: [] },
        ]);
        const [sealed] = yield* accounts(test);
        expect(sealed.accessToken).not.toBe(LEGACY_ACCESS);
        expect(sealed.refreshToken).not.toBe(LEGACY_REFRESH);
        expect(yield* unseal(sealed.refreshToken)).toBe(LEGACY_REFRESH);
        expect(yield* readAccessToken(test, cookie)).toBe(LEGACY_ACCESS);

        expect(yield* pass(test)).toMatchObject([
          { encrypted: 0, isDone: true, scanned: 1, unreadable: [] },
        ]);
        expect(yield* accounts(test)).toEqual([sealed]);
      })
  );

  it.effect(
    "keeps sign-in and the token route working while a row still holds plain tokens",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const cookie = yield* legacyLearner(test, "returning");
        expect(yield* readAccessToken(test, cookie)).toBe(LEGACY_ACCESS);

        const again = yield* Effect.promise(() =>
          signInWithGoogle(test, "returning", NOW)
        );
        expect(again.status).toBe(302);
        expect(again.headers.get("location")).toBe("/en");

        const [row] = yield* accounts(test);
        expect(row.accessToken).not.toBe(LEGACY_ACCESS);
        expect(yield* unseal(row.accessToken)).toBe("access-returning");
        expect(yield* unseal(row.refreshToken)).toBe("refresh-returning");
        expect(yield* pass(test)).toMatchObject([
          { encrypted: 0, isDone: true, scanned: 1, unreadable: [] },
        ]);
      })
  );

  it.effect(
    "refuses a Google ID token on the link route, so no token that comes with it is stored",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const signedIn = yield* Effect.promise(() =>
          signInWithGoogle(test, "linking", NOW)
        );
        const stored = yield* accounts(test);
        vi.stubGlobal("fetch", keyLookup);

        const response = yield* Effect.promise(() =>
          test.fetch("/api/auth/link-social", {
            body: encodeJsonText({
              idToken: {
                accessToken: "ya29.arrives-plain",
                refreshToken: "1//arrives-plain",
                token: createGoogleIdToken("linking", NOW, GOOGLE_KEY),
              },
              provider: "google",
            }),
            headers: {
              "content-type": "application/json",
              cookie: cookieHeader(signedIn),
              origin: "http://localhost:3000",
            },
            method: "POST",
          })
        );

        expect(response.status).toBe(401);
        expect(yield* Effect.promise(() => response.json())).toMatchObject({
          code: "INVALID_TOKEN",
        });
        // Checking a token starts with a request for Google's signing keys.
        expect(keyLookup).not.toHaveBeenCalled();
        expect(yield* accounts(test)).toEqual(stored);
      })
  );

  it.effect(
    "reads page after page, seals only plain tokens, and reports what it cannot read",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const sealedAccess = yield* Effect.promise(() =>
          symmetricEncrypt({ data: "ya29.sealed-access", key: SECRET })
        );
        const sealedRefresh = yield* Effect.promise(() =>
          symmetricEncrypt({ data: "1//sealed-refresh", key: SECRET })
        );
        const named: readonly Seed[] = [
          {
            accessToken: "ya29.both",
            accountId: "both",
            refreshToken: "1//both",
          },
          {
            accessToken: "ya29.access-only",
            accountId: "access-only",
            refreshToken: null,
          },
          { accountId: "refresh-only", refreshToken: "1//refresh-only" },
          {
            accessToken: sealedAccess,
            accountId: "sealed",
            refreshToken: sealedRefresh,
          },
          { accountId: "empty" },
          {
            accessToken: "deadbeef",
            accountId: "access-unreadable",
            refreshToken: "1//beside-access",
          },
          {
            accessToken: "ya29.beside-refresh",
            accountId: "refresh-unreadable",
            refreshToken: "cafe",
          },
        ];
        // The fillers end the first page, so the last row needs the cursor.
        const fillers = Arr.makeBy(
          TOKEN_PAGE_SIZE - named.length,
          (index): Seed => ({ accountId: `filler-${index}` })
        );
        const last: Seed = { accessToken: "ya29.last", accountId: "last" };
        yield* Effect.forEach(
          Arr.appendAll(Arr.appendAll(named, fillers), [last]),
          (row) => seed(test, row),
          { discard: true }
        );

        const first = yield* pass(test);
        expect(first).toMatchObject([
          { encrypted: 5, isDone: false, scanned: TOKEN_PAGE_SIZE },
          { encrypted: 1, isDone: true, scanned: 1, unreadable: [] },
        ]);

        const rows = yield* accounts(test);
        const stored = (accountId: string) =>
          Arr.findFirst(rows, (row) => row.accountId === accountId).pipe(
            Effect.fromOption,
            Effect.orDie
          );
        const both = yield* stored("both");
        expect(yield* unseal(both.accessToken)).toBe("ya29.both");
        expect(yield* unseal(both.refreshToken)).toBe("1//both");
        const accessOnly = yield* stored("access-only");
        expect(yield* unseal(accessOnly.accessToken)).toBe("ya29.access-only");
        expect(accessOnly.refreshToken).toBeNull();
        const refreshOnly = yield* stored("refresh-only");
        expect(refreshOnly).not.toHaveProperty("accessToken");
        expect(yield* unseal(refreshOnly.refreshToken)).toBe("1//refresh-only");
        expect(yield* stored("sealed")).toMatchObject({
          accessToken: sealedAccess,
          refreshToken: sealedRefresh,
        });
        expect(yield* stored("empty")).not.toHaveProperty("accessToken");
        const accessUnreadable = yield* stored("access-unreadable");
        expect(accessUnreadable.accessToken).toBe("deadbeef");
        expect(yield* unseal(accessUnreadable.refreshToken)).toBe(
          "1//beside-access"
        );
        const refreshUnreadable = yield* stored("refresh-unreadable");
        expect(yield* unseal(refreshUnreadable.accessToken)).toBe(
          "ya29.beside-refresh"
        );
        expect(refreshUnreadable.refreshToken).toBe("cafe");
        expect(yield* unseal((yield* stored("last")).accessToken)).toBe(
          "ya29.last"
        );

        // Each unreadable token is named by its row and column, with a reason.
        const unreadable = [
          {
            account: accessUnreadable._id,
            field: "accessToken",
            reason: expect.stringMatching(NOT_BLANK),
          },
          {
            account: refreshUnreadable._id,
            field: "refreshToken",
            reason: expect.stringMatching(NOT_BLANK),
          },
        ];
        expect(first[0].unreadable).toEqual(unreadable);
        expect(yield* pass(test)).toMatchObject([
          { encrypted: 0, isDone: false, scanned: TOKEN_PAGE_SIZE, unreadable },
          { encrypted: 0, isDone: true, scanned: 1, unreadable: [] },
        ]);
        expect(yield* accounts(test)).toEqual(rows);
      })
  );

  it.effect(
    "seals with the newest secret while the secret rotates, leaves older cipher text alone, and names a retired version",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("BETTER_AUTH_SECRETS", `2:${ROTATED},1:${SECRET}`);
        const test = createConvexTestWithBetterAuth();
        const bare = yield* Effect.promise(() =>
          symmetricEncrypt({ data: "ya29.bare", key: SECRET })
        );
        const enveloped = formatEnvelope(1, bare);
        // Version 3 is in no list of this deployment, as if it was retired.
        const retired = formatEnvelope(3, bare);
        const seeds: readonly Seed[] = [
          { accessToken: "ya29.plain", accountId: "plain" },
          { accessToken: bare, accountId: "bare" },
          { accessToken: enveloped, accountId: "enveloped" },
          { accessToken: retired, accountId: "retired" },
        ];
        yield* Effect.forEach(seeds, (row) => seed(test, row), {
          discard: true,
        });

        const first = yield* pass(test);
        const rows = yield* accounts(test);
        const [plain, ...older] = rows;
        const unreadable = [
          {
            account: older[2]._id,
            field: "accessToken",
            reason: expect.stringContaining("Secret version 3 not found"),
          },
        ];
        expect(first).toMatchObject([
          { encrypted: 1, isDone: true, scanned: 4, unreadable },
        ]);
        const sealed = yield* Effect.fromNullishOr(plain.accessToken).pipe(
          Effect.orDie
        );
        const envelope = yield* Effect.fromNullishOr(
          parseEnvelope(sealed)
        ).pipe(Effect.orDie);
        expect(envelope.version).toBe(2);
        expect(
          yield* Effect.promise(() =>
            symmetricDecrypt({ data: envelope.ciphertext, key: ROTATED })
          )
        ).toBe("ya29.plain");
        expect(Arr.map(older, (row) => row.accessToken)).toEqual([
          bare,
          enveloped,
          retired,
        ]);

        expect(yield* pass(test)).toMatchObject([
          { encrypted: 0, isDone: true, scanned: 4, unreadable },
        ]);
        expect(yield* accounts(test)).toEqual(rows);
      })
  );

  it.effect(
    "refuses to seal under the default secret of Better Auth, and writes nothing",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("BETTER_AUTH_SECRET", undefined);
        vi.stubEnv("BETTER_AUTH_SECRETS", undefined);
        vi.stubEnv("AUTH_SECRET", undefined);
        const test = createConvexTestWithBetterAuth();
        yield* seed(test, { accessToken: LEGACY_ACCESS, accountId: "plain" });

        yield* Effect.promise(() =>
          expect(
            test.mutation(Ref.getFunctionReference(encrypt), { cursor: null })
          ).rejects.toMatchObject({
            data: { _tag: "AuthSecretMissing", code: "AUTH_SECRET_MISSING" },
          })
        );
        expect(yield* accounts(test)).toMatchObject([
          { accessToken: LEGACY_ACCESS },
        ]);
      })
  );
});

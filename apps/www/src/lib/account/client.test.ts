import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { makeFunctionReference } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import {
  readAccountOptional,
  readAccountRequired,
  resolveAccountClient,
  resolveBrowserClient,
} from "@/lib/account/client";
import type { AuthConvex } from "@/lib/auth/client";
import { QueryReadFailed } from "@/lib/convex/read";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Builds a JWT-shaped access token with the given expiry in epoch seconds. */
function tokenWithExpiry(exp: number) {
  return `head.${Base64Url.encode(encodeJson({ exp, sub: "session-1" }))}.sig`;
}

const FRESH_TOKEN = tokenWithExpiry(4_102_444_800);
const EXPIRED_TOKEN = tokenWithExpiry(1);

const mocks = vi.hoisted(() => ({
  convexMutation: vi.fn(),
  fetchAccessToken:
    vi.fn<(opts: { forceRefreshToken: boolean }) => Promise<string | null>>(),
  getAccessToken: vi.fn<() => string | null>(),
  hasSignedInHint: vi.fn<(cookie: string) => boolean>(),
  httpQuery: vi.fn(),
  httpSetAuth: vi.fn<(token: string) => void>(),
  readAuthClient:
    vi.fn<
      (convex: AuthConvex) => Effect.Effect<{
        fetchAccessToken: (opts: {
          forceRefreshToken: boolean;
        }) => Promise<string | null>;
        getAccessToken: () => string | null;
      }>
    >(),
  readConvexClient: vi.fn(),
  readMadeClient: vi.fn<() => Option.Option<{ query: typeof vi.fn }>>(),
  readQueryOn:
    vi.fn<
      (
        client: unknown,
        ref: unknown,
        args: unknown
      ) => Effect.Effect<unknown, unknown>
    >(),
  reportClientException:
    vi.fn<(error: unknown, properties: unknown) => Effect.Effect<void>>(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.httpQuery;
    setAuth = mocks.httpSetAuth;
  },
}));

vi.mock("@/lib/convex/client", () => ({
  readConvexClient: mocks.readConvexClient,
  readMadeClient: mocks.readMadeClient,
}));

vi.mock("@/lib/convex/read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/convex/read")>();
  return {
    ...actual,
    readQueryOn: mocks.readQueryOn,
  };
});

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: mocks.readAuthClient,
}));

vi.mock("@/lib/auth/hint", () => ({
  hasSignedInHint: mocks.hasSignedInHint,
}));

vi.mock("@/lib/analytics/client", () => ({
  reportClientException: mocks.reportClientException,
}));

const liveClient = { query: vi.fn() };
const MUTATION = makeFunctionReference<"mutation">("auth/school:signIn");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSignedInHint.mockReturnValue(false);
  mocks.readMadeClient.mockReturnValue(Option.none());
  mocks.readConvexClient.mockReturnValue({ mutation: mocks.convexMutation });
  mocks.getAccessToken.mockReturnValue(null);
  mocks.fetchAccessToken.mockResolvedValue(null);
  mocks.readAuthClient.mockReturnValue(
    Effect.succeed({
      fetchAccessToken: mocks.fetchAccessToken,
      getAccessToken: mocks.getAccessToken,
    })
  );
  mocks.reportClientException.mockReturnValue(Effect.void);
});

describe("resolveAccountClient", () => {
  it.effect("reuses the open live client when one already exists", () =>
    Effect.gen(function* () {
      mocks.readMadeClient.mockReturnValue(Option.some(liveClient));
      const client = yield* resolveAccountClient();
      expect(client).toEqual(Option.some(liveClient));
      expect(mocks.readAuthClient).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reuses a fresh cached access token from AuthClient with zero refreshes and keeps readConvexClient lazy",
    () =>
      Effect.gen(function* () {
        mocks.getAccessToken.mockReturnValue(FRESH_TOKEN);
        const client = yield* resolveAccountClient();
        expect(Option.isSome(client)).toBe(true);
        expect(mocks.httpSetAuth).toHaveBeenCalledExactlyOnceWith(FRESH_TOKEN);
        expect(mocks.fetchAccessToken).not.toHaveBeenCalled();
        expect(mocks.readConvexClient).not.toHaveBeenCalled();

        const passed = mocks.readAuthClient.mock.calls[0]?.[0];
        mocks.convexMutation.mockResolvedValueOnce("ok");
        expect(
          yield* Effect.promise(
            async () => await passed?.mutation(MUTATION, {})
          )
        ).toBe("ok");
        expect(mocks.readConvexClient).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "refreshes through AuthClient's mutex when the cached token is expired or absent",
    () =>
      Effect.gen(function* () {
        mocks.getAccessToken.mockReturnValueOnce(EXPIRED_TOKEN);
        mocks.fetchAccessToken.mockResolvedValueOnce(FRESH_TOKEN);
        const refreshed = yield* resolveAccountClient();
        expect(Option.isSome(refreshed)).toBe(true);
        expect(mocks.fetchAccessToken).toHaveBeenCalledExactlyOnceWith({
          forceRefreshToken: true,
        });
        expect(mocks.httpSetAuth).toHaveBeenCalledExactlyOnceWith(FRESH_TOKEN);

        mocks.getAccessToken.mockReturnValueOnce(null);
        mocks.fetchAccessToken.mockResolvedValueOnce(null);
        const missing = yield* resolveAccountClient();
        expect(Option.isNone(missing)).toBe(true);
      })
  );

  it.effect(
    "maps an AuthClient refresh failure to QueryReadFailed in the error channel",
    () =>
      Effect.gen(function* () {
        mocks.fetchAccessToken.mockRejectedValueOnce(new Error("refresh down"));
        const failure = yield* resolveAccountClient().pipe(Effect.flip);
        expect(failure).toBeInstanceOf(QueryReadFailed);
      })
  );
});

describe("resolveBrowserClient", () => {
  it.effect("reuses the open live client when one exists", () =>
    Effect.gen(function* () {
      mocks.readMadeClient.mockReturnValue(Option.some(liveClient));
      const result = yield* resolveBrowserClient("");
      expect(result).toEqual({ client: liveClient, signedIn: true });
    })
  );

  it.effect(
    "authenticates an HTTP client when the signed-in hint holds a session",
    () =>
      Effect.gen(function* () {
        mocks.hasSignedInHint.mockReturnValue(true);
        mocks.getAccessToken.mockReturnValue(FRESH_TOKEN);
        const result = yield* resolveBrowserClient("signed-in=1");
        expect(result.signedIn).toBe(true);
        expect(mocks.httpSetAuth).toHaveBeenCalledExactlyOnceWith(FRESH_TOKEN);
      })
  );

  it.effect(
    "falls back to an unauthenticated HTTP client when no session exists",
    () =>
      Effect.gen(function* () {
        mocks.hasSignedInHint.mockReturnValue(true);
        mocks.fetchAccessToken.mockResolvedValue(null);
        const result = yield* resolveBrowserClient("signed-in=1");
        expect(result.signedIn).toBe(false);
        expect(mocks.httpSetAuth).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "returns an unauthenticated HTTP client without touching AuthClient for a visitor",
    () =>
      Effect.gen(function* () {
        const result = yield* resolveBrowserClient("");
        expect(result.signedIn).toBe(false);
        expect(mocks.readAuthClient).not.toHaveBeenCalled();
      })
  );
});

describe("readAccountOptional", () => {
  it.effect("returns the value on success", () =>
    Effect.gen(function* () {
      mocks.readQueryOn.mockReturnValue(Effect.succeed({ ok: true }));
      const value = yield* readAccountOptional(
        liveClient,
        auth.queries.getCurrentUser,
        {},
        "test.source"
      );
      expect(value).toEqual({ ok: true });
    })
  );

  it.effect("silences typed refusals without reporting", () =>
    Effect.gen(function* () {
      mocks.readQueryOn.mockReturnValue(
        Effect.fail({ _tag: "SessionRequired" })
      );
      const value = yield* readAccountOptional(
        liveClient,
        auth.queries.getCurrentUser,
        {},
        "test.source"
      );
      expect(value).toBeUndefined();
      expect(mocks.reportClientException).not.toHaveBeenCalled();
    })
  );

  it.effect("reports QueryReadFailed and returns undefined", () =>
    Effect.gen(function* () {
      const failure = new QueryReadFailed({ cause: "boom" });
      mocks.readQueryOn.mockReturnValue(Effect.fail(failure));
      const value = yield* readAccountOptional(
        liveClient,
        auth.queries.getCurrentUser,
        {},
        "test.source"
      );
      expect(value).toBeUndefined();
      expect(mocks.reportClientException).toHaveBeenCalledExactlyOnceWith(
        failure,
        {
          operation: auth.queries.getCurrentUser.convexFunctionName,
          source: "test.source",
        }
      );
    })
  );
});

describe("readAccountRequired", () => {
  it.effect("wraps successful reads in Value", () =>
    Effect.gen(function* () {
      mocks.readQueryOn.mockReturnValue(Effect.succeed(null));
      const outcome = yield* readAccountRequired(
        liveClient,
        auth.queries.getCurrentUser,
        {}
      );
      expect(outcome).toEqual({ _tag: "Value", value: null });
    })
  );

  it.effect(
    "maps SessionRequired to SignedOut and other refusals to NotFound",
    () =>
      Effect.gen(function* () {
        mocks.readQueryOn.mockReturnValueOnce(
          Effect.fail({ _tag: "SessionRequired" })
        );
        expect(
          yield* readAccountRequired(
            liveClient,
            auth.queries.getCurrentUser,
            {}
          )
        ).toEqual({ _tag: "SignedOut" });

        mocks.readQueryOn.mockReturnValueOnce(
          Effect.fail({ _tag: "AccessDenied" })
        );
        expect(
          yield* readAccountRequired(
            liveClient,
            auth.queries.getCurrentUser,
            {}
          )
        ).toEqual({ _tag: "NotFound" });
      })
  );

  it.effect("keeps QueryReadFailed in the error channel", () =>
    Effect.gen(function* () {
      const failure = new QueryReadFailed({ cause: "offline" });
      mocks.readQueryOn.mockReturnValue(Effect.fail(failure));
      const error = yield* readAccountRequired(
        liveClient,
        auth.queries.getCurrentUser,
        {}
      ).pipe(Effect.flip);
      expect(error).toBe(failure);
    })
  );
});

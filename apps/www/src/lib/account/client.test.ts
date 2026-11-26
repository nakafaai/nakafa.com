import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Effect, Option } from "effect";
import {
  readAccountOptional,
  readAccountRequired,
  resolveAccountClient,
  resolveBrowserClient,
} from "@/lib/account/client";
import { QueryReadFailed } from "@/lib/convex/read";

const mocks = vi.hoisted(() => ({
  hasSignedInHint: vi.fn<(cookie: string) => boolean>(),
  httpQuery: vi.fn(),
  httpSetAuth: vi.fn<(token: string) => void>(),
  readBrowserSession:
    vi.fn<
      (
        origin: string
      ) => Effect.Effect<{ accessToken: string; userId: string } | null>
    >(),
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
  readMadeClient: mocks.readMadeClient,
}));

vi.mock("@/lib/convex/read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/convex/read")>();
  return {
    ...actual,
    readQueryOn: mocks.readQueryOn,
  };
});

vi.mock("@/lib/auth/token", () => ({
  readBrowserSession: mocks.readBrowserSession,
}));

vi.mock("@/lib/auth/hint", () => ({
  hasSignedInHint: mocks.hasSignedInHint,
}));

vi.mock("@/lib/analytics/client", () => ({
  reportClientException: mocks.reportClientException,
}));

const liveClient = { query: vi.fn() };
const ORIGIN = "https://nakafa.com";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSignedInHint.mockReturnValue(false);
  mocks.readMadeClient.mockReturnValue(Option.none());
  mocks.reportClientException.mockReturnValue(Effect.void);
});

describe("resolveAccountClient", () => {
  it.effect("reuses the open live client when one already exists", () =>
    Effect.gen(function* () {
      mocks.readMadeClient.mockReturnValue(Option.some(liveClient));
      const client = yield* resolveAccountClient(ORIGIN);
      expect(client).toEqual(Option.some(liveClient));
      expect(mocks.readBrowserSession).not.toHaveBeenCalled();
    })
  );

  it.effect("returns none on a cold load with no session", () =>
    Effect.gen(function* () {
      mocks.readBrowserSession.mockReturnValue(Effect.succeed(null));
      const client = yield* resolveAccountClient(ORIGIN);
      expect(Option.isNone(client)).toBe(true);
    })
  );

  it.effect("authenticates an HTTP client on a cold load with a session", () =>
    Effect.gen(function* () {
      mocks.readBrowserSession.mockReturnValue(
        Effect.succeed({ accessToken: "cold-tok", userId: "u1" })
      );
      const client = yield* resolveAccountClient(ORIGIN);
      expect(Option.isSome(client)).toBe(true);
      expect(mocks.httpSetAuth).toHaveBeenCalledExactlyOnceWith("cold-tok");
    })
  );
});

describe("resolveBrowserClient", () => {
  it.effect("reuses the open live client when one exists", () =>
    Effect.gen(function* () {
      mocks.readMadeClient.mockReturnValue(Option.some(liveClient));
      const result = yield* resolveBrowserClient("", ORIGIN);
      expect(result).toEqual({ client: liveClient, signedIn: true });
    })
  );

  it.effect(
    "authenticates an HTTP client when the signed-in hint holds a session",
    () =>
      Effect.gen(function* () {
        mocks.hasSignedInHint.mockReturnValue(true);
        mocks.readBrowserSession.mockReturnValue(
          Effect.succeed({ accessToken: "hint-tok", userId: "u1" })
        );
        const result = yield* resolveBrowserClient("signed-in=1", ORIGIN);
        expect(result.signedIn).toBe(true);
        expect(mocks.httpSetAuth).toHaveBeenCalledExactlyOnceWith("hint-tok");
      })
  );

  it.effect(
    "falls back to an unauthenticated HTTP client when no session exists",
    () =>
      Effect.gen(function* () {
        mocks.hasSignedInHint.mockReturnValue(true);
        mocks.readBrowserSession.mockReturnValue(Effect.succeed(null));
        const result = yield* resolveBrowserClient("signed-in=1", ORIGIN);
        expect(result.signedIn).toBe(false);
        expect(mocks.httpSetAuth).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "returns an unauthenticated HTTP client without refreshing for a visitor",
    () =>
      Effect.gen(function* () {
        const result = yield* resolveBrowserClient("", ORIGIN);
        expect(result.signedIn).toBe(false);
        expect(mocks.readBrowserSession).not.toHaveBeenCalled();
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

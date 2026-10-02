import { describe, expect, it } from "@effect/vitest";
import type { ConvexReactClient } from "convex/react";
import { Deferred, Effect, Exit, Option, Scope } from "effect";
import {
  authenticateConvex,
  ConvexAuthConfirmation,
  ConvexTokenReadError,
  createConvexAuthStore,
  readConvexAuth,
  readConvexSessionId,
} from "@/lib/auth/convex";
import { type AuthSession, previewAuthSession } from "@/lib/auth/session";

const pending = {
  hasError: false,
  isPending: true,
  sessionId: null,
  userId: null,
} satisfies AuthSession;

function signedIn(sessionId: string) {
  return {
    hasError: false,
    isPending: false,
    sessionId,
    userId: "user-1",
  } satisfies AuthSession;
}

function answer(sessionId: string, isAuthenticated: boolean) {
  return Option.some(
    ConvexAuthConfirmation.make({ isAuthenticated, sessionId })
  );
}

function makeClient() {
  return { setAuth: vi.fn<ConvexReactClient["setAuth"]>() };
}

/** Authenticates one session in a fresh scope and returns its handles. */
const startSession = Effect.fnUntraced(function* (
  readToken: Effect.Effect<string, ConvexTokenReadError> = Effect.succeed(
    "token-1"
  )
) {
  const client = makeClient();
  const store = createConvexAuthStore();
  const scope = yield* Scope.make();
  yield* Scope.provide(
    authenticateConvex({ client, readToken, sessionId: "session-1", store }),
    scope
  );
  return { client, scope, store };
});

/** Returns the token fetcher and status callback of one setAuth call. */
function readBinding(client: ReturnType<typeof makeClient>) {
  const call = client.setAuth.mock.calls[0];
  if (call === undefined) {
    return expect.unreachable("setAuth was not called");
  }
  const [fetchToken, onChange] = call;
  if (onChange === undefined) {
    return expect.unreachable("setAuth has no status callback");
  }
  return { fetchToken, onChange };
}

describe("Convex authentication", () => {
  it.each([
    [pending, null],
    [signedIn("session-1"), "session-1"],
    [previewAuthSession, null],
  ])(
    "holds credentials only for a settled signed-in session",
    (session, id) => {
      expect(readConvexSessionId(session)).toBe(id);
    }
  );

  it.each([
    [pending, Option.none(), { isAuthenticated: false, isLoading: true }],
    [
      previewAuthSession,
      answer("session-1", true),
      { isAuthenticated: false, isLoading: false },
    ],
    [
      signedIn("session-1"),
      Option.none(),
      { isAuthenticated: false, isLoading: true },
    ],
    [
      signedIn("session-2"),
      answer("session-1", true),
      { isAuthenticated: false, isLoading: true },
    ],
    [
      signedIn("session-1"),
      answer("session-1", true),
      { isAuthenticated: true, isLoading: false },
    ],
    [
      signedIn("session-1"),
      answer("session-1", false),
      { isAuthenticated: false, isLoading: false },
    ],
  ])(
    "derives what readers see from the session and Convex's answer",
    (session, confirmation, expected) => {
      expect(readConvexAuth(session, confirmation)).toStrictEqual(expected);
    }
  );

  it("starts without an answer, as the server renders it", () => {
    expect(createConvexAuthStore().getState().confirmation).toStrictEqual(
      Option.none()
    );
  });

  it.effect("records Convex's answer for the session it authenticates", () =>
    Effect.gen(function* () {
      const { client, store } = yield* startSession();

      expect(client.setAuth).toHaveBeenCalledTimes(1);
      readBinding(client).onChange(true);

      expect(store.getState().confirmation).toStrictEqual(
        answer("session-1", true)
      );
    })
  );

  it.effect("forgets the answer and ignores late ones once it ends", () =>
    Effect.gen(function* () {
      const { client, scope, store } = yield* startSession();
      const { onChange } = readBinding(client);
      onChange(true);

      yield* Scope.close(scope, Exit.void);
      expect(store.getState().confirmation).toStrictEqual(Option.none());

      onChange(true);
      expect(store.getState().confirmation).toStrictEqual(Option.none());
      expect(client.setAuth).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "shares one token until Convex asks for a fresh one and retries failures",
    () =>
      Effect.gen(function* () {
        const read = vi
          .fn<() => Effect.Effect<string, ConvexTokenReadError>>()
          .mockReturnValueOnce(Effect.succeed("token-1"))
          .mockReturnValueOnce(
            Effect.fail(new ConvexTokenReadError({ detail: "No token." }))
          )
          .mockReturnValueOnce(Effect.succeed("token-2"));
        const { client } = yield* startSession(Effect.suspend(read));
        const { fetchToken } = readBinding(client);
        const fetch = (forceRefreshToken: boolean) =>
          Effect.promise(() => fetchToken({ forceRefreshToken }));

        expect(yield* fetch(false)).toBe("token-1");
        expect(yield* fetch(false)).toBe("token-1");
        expect(yield* fetch(true)).toBeNull();
        expect(yield* fetch(false)).toBe("token-2");
        expect(read).toHaveBeenCalledTimes(3);
      })
  );

  it.effect("answers concurrent requests from the one read in flight", () =>
    Effect.gen(function* () {
      const release = yield* Deferred.make<void>();
      const read = vi.fn(() =>
        Deferred.await(release).pipe(Effect.as("token-1"))
      );
      const { client } = yield* startSession(Effect.suspend(read));
      const { fetchToken } = readBinding(client);
      const requests = Promise.all([
        fetchToken({ forceRefreshToken: false }),
        fetchToken({ forceRefreshToken: false }),
        fetchToken({ forceRefreshToken: false }),
      ]);
      yield* Effect.yieldNow;
      yield* Deferred.succeed(release, undefined);

      expect(yield* Effect.promise(() => requests)).toStrictEqual([
        "token-1",
        "token-1",
        "token-1",
      ]);
      expect(read).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("reads afresh when Convex asks during a read in flight", () =>
    Effect.gen(function* () {
      const release = yield* Deferred.make<void>();
      const read = vi
        .fn<() => Effect.Effect<string, ConvexTokenReadError>>()
        .mockReturnValueOnce(Deferred.await(release).pipe(Effect.as("token-1")))
        .mockReturnValueOnce(Effect.succeed("token-2"));
      const { client } = yield* startSession(Effect.suspend(read));
      const { fetchToken } = readBinding(client);
      const stale = fetchToken({ forceRefreshToken: false });
      yield* Effect.yieldNow;
      const fresh = fetchToken({ forceRefreshToken: true });
      yield* Deferred.succeed(release, undefined);

      expect(
        yield* Effect.promise(() => Promise.all([stale, fresh]))
      ).toStrictEqual(["token-1", "token-2"]);
      expect(
        yield* Effect.promise(() => fetchToken({ forceRefreshToken: false }))
      ).toBe("token-2");
      expect(read).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "answers every concurrent request when the read fails and retries after",
    () =>
      Effect.gen(function* () {
        const release = yield* Deferred.make<void>();
        const read = vi
          .fn<() => Effect.Effect<string, ConvexTokenReadError>>()
          .mockReturnValueOnce(
            Deferred.await(release).pipe(
              Effect.andThen(
                Effect.fail(new ConvexTokenReadError({ detail: "No token." }))
              )
            )
          )
          .mockReturnValueOnce(Effect.succeed("token-2"));
        const { client } = yield* startSession(Effect.suspend(read));
        const { fetchToken } = readBinding(client);
        const requests = Promise.all([
          fetchToken({ forceRefreshToken: false }),
          fetchToken({ forceRefreshToken: false }),
          fetchToken({ forceRefreshToken: false }),
        ]);
        yield* Effect.yieldNow;
        yield* Deferred.succeed(release, undefined);

        expect(yield* Effect.promise(() => requests)).toStrictEqual([
          null,
          null,
          null,
        ]);
        expect(
          yield* Effect.promise(() => fetchToken({ forceRefreshToken: false }))
        ).toBe("token-2");
        expect(read).toHaveBeenCalledTimes(2);
      })
  );
});

import { describe, expect, it } from "@effect/vitest";
import type { ConvexReactClient } from "convex/react";
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  MutableList,
  Option,
  Queue,
  Scope,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import {
  authenticateConvex,
  ConvexAuthConfirmation,
  ConvexTokenReadError,
  createConvexAuthStore,
  hasSettledSignedOut,
  pageReturns,
  readConvexAuth,
  readConvexSessionId,
  releaseConvexAuth,
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

/** A token read that failed, and whether asking again may answer otherwise. */
function failedRead(retryable: boolean) {
  return Effect.fail(
    new ConvexTokenReadError({ detail: "No token.", retryable })
  );
}

/** Authenticates one session in a fresh scope and returns its handles. */
const startSession = Effect.fnUntraced(function* (
  readToken: Effect.Effect<string, ConvexTokenReadError> = Effect.succeed(
    "token-1"
  ),
  returns: Stream.Stream<unknown> = Stream.empty
) {
  const client = makeClient();
  const store = createConvexAuthStore();
  const scope = yield* Scope.make();
  yield* Scope.provide(
    authenticateConvex({
      client,
      readToken,
      returns,
      sessionId: "session-1",
      store,
    }),
    scope
  );
  return { client, scope, store };
});

/** Returns the token fetcher and status callback of one setAuth call. */
function readBinding(client: ReturnType<typeof makeClient>, index = 0) {
  const call = client.setAuth.mock.calls[index];
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
    [pending, null, null],
    [signedIn("session-1"), null, "session-1"],
    [previewAuthSession, null, null],
  ])(
    "holds credentials only for a settled signed-in session when the browser knows none",
    (session, known, id) => {
      expect(readConvexSessionId(session, known)).toBe(id);
    }
  );

  it.each([
    [pending, "session-1", "session-1"],
    [signedIn("session-2"), "session-1", "session-2"],
    [previewAuthSession, "session-1", null],
  ])(
    "holds the session the browser last had only until Better Auth answers",
    (session, known, id) => {
      expect(readConvexSessionId(session, known)).toBe(id);
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
      { isAuthenticated: false, isLoading: true },
    ],
  ])(
    "derives what readers see from the session and Convex's answer",
    (session, confirmation, expected) => {
      expect(readConvexAuth(session, confirmation)).toStrictEqual(expected);
    }
  );

  it.each([
    [pending, false],
    [signedIn("session-1"), false],
    [previewAuthSession, true],
  ])("knows a session that settled on none", (session, settled) => {
    expect(hasSettledSignedOut(session)).toBe(settled);
  });

  it("releases the client's hold with a token request that answers none", async () => {
    const client = makeClient();

    releaseConvexAuth(client);

    const [fetchToken] = client.setAuth.mock.calls[0] ?? [];
    expect(client.setAuth).toHaveBeenCalledOnce();
    expect(await fetchToken?.({ forceRefreshToken: true })).toBeNull();
  });

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
    "tells the readers of a session with no token before Convex runs a query without one",
    () =>
      Effect.gen(function* () {
        const { client, store } = yield* startSession(failedRead(false));
        const { fetchToken } = readBinding(client);
        const heard = MutableList.make<string>();
        // The store's change queues React's render, which drops the readers'
        // subscriptions, before Convex's continuation drops its credentials.
        store.subscribe(({ confirmation }) => {
          MutableList.append(
            heard,
            `store ${Option.exists(confirmation, (answer) => answer.isAuthenticated)}`
          );
        });
        const token = yield* Effect.promise(() =>
          fetchToken({ forceRefreshToken: true }).then((answer) => {
            MutableList.append(heard, `convex ${answer}`);
            return answer;
          })
        );

        expect(token).toBeNull();
        expect(MutableList.toArray(heard)).toStrictEqual([
          "store false",
          "convex null",
        ]);
        expect(store.getState().confirmation).toStrictEqual(
          answer("session-1", false)
        );
      })
  );

  it.effect(
    "shares one token until Convex asks for a fresh one and retries failures",
    () =>
      Effect.gen(function* () {
        const read = vi
          .fn<() => Effect.Effect<string, ConvexTokenReadError>>()
          .mockReturnValueOnce(Effect.succeed("token-1"))
          .mockReturnValueOnce(failedRead(false))
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
            Deferred.await(release).pipe(Effect.andThen(failedRead(false)))
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
  it.effect(
    "reads again on the network schedule while a read fails on its way",
    () =>
      Effect.gen(function* () {
        const read = vi
          .fn<() => Effect.Effect<string, ConvexTokenReadError>>()
          .mockReturnValueOnce(failedRead(true))
          .mockReturnValueOnce(failedRead(true))
          .mockReturnValueOnce(Effect.succeed("token-1"));
        const { client } = yield* startSession(Effect.suspend(read));
        const { fetchToken } = readBinding(client);
        const request = fetchToken({ forceRefreshToken: false });
        yield* Effect.yieldNow;
        yield* TestClock.adjust("500 millis");
        yield* TestClock.adjust("1 second");

        expect(yield* Effect.promise(() => request)).toBe("token-1");
        expect(read).toHaveBeenCalledTimes(3);
      })
  );

  it.effect(
    "answers none after two more reads fail on their way, and asks a refusal once",
    () =>
      Effect.gen(function* () {
        const read = vi.fn(() => failedRead(true));
        const { client } = yield* startSession(Effect.suspend(read));
        const { fetchToken } = readBinding(client);
        const request = fetchToken({ forceRefreshToken: false });
        yield* Effect.yieldNow;
        yield* TestClock.adjust("1500 millis");

        expect(yield* Effect.promise(() => request)).toBeNull();
        expect(read).toHaveBeenCalledTimes(3);

        const refused = vi.fn(() => failedRead(false));
        const second = yield* startSession(Effect.suspend(refused));
        const answer = readBinding(second.client).fetchToken({
          forceRefreshToken: false,
        });

        expect(yield* Effect.promise(() => answer)).toBeNull();
        expect(refused).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "hands a refused session to Convex again when the reader comes back",
    () =>
      Effect.gen(function* () {
        const returns = yield* Queue.unbounded<void>();
        const { client, store } = yield* startSession(
          Effect.succeed("token-1"),
          Stream.fromQueue(returns)
        );
        const comeBack = Effect.gen(function* () {
          yield* Queue.offer(returns, undefined);
          yield* Effect.yieldNow;
          yield* Effect.yieldNow;
        });

        yield* comeBack;
        expect(client.setAuth).toHaveBeenCalledOnce();

        readBinding(client).onChange(false);
        yield* comeBack;
        expect(client.setAuth).toHaveBeenCalledTimes(2);

        readBinding(client, 1).onChange(true);
        yield* comeBack;
        expect(client.setAuth).toHaveBeenCalledTimes(2);
        expect(store.getState().confirmation).toStrictEqual(
          answer("session-1", true)
        );
      }).pipe(Effect.scoped)
  );

  it.effect(
    "hears the reader come back when the tab shows again or the network returns",
    () =>
      Effect.gen(function* () {
        const visibility = vi.spyOn(document, "visibilityState", "get");
        const listened = vi.spyOn(window, "addEventListener");
        const heard = yield* pageReturns.pipe(
          Stream.take(2),
          Stream.runCollect,
          Effect.forkScoped
        );
        // The stream hears the page once it has added its listeners.
        yield* Effect.promise(() =>
          vi.waitFor(() => {
            expect(listened).toHaveBeenCalledWith(
              "online",
              expect.any(Function)
            );
          })
        );

        visibility.mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("online"));
        visibility.mockReturnValue("visible");
        document.dispatchEvent(new Event("visibilitychange"));

        expect(yield* Fiber.join(heard)).toStrictEqual([
          "online",
          "visibilitychange",
        ]);
        visibility.mockRestore();
        listened.mockRestore();
      }).pipe(Effect.scoped)
  );
});

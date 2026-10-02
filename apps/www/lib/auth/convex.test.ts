import { describe, expect, it } from "@effect/vitest";
import type { ConvexReactClient } from "convex/react";
import { Effect, Fiber } from "effect";
import { createStore } from "zustand";
import {
  bindConvexAuth,
  type ConvexAuth,
  ConvexTokenReadError,
  readInitialConvexAuth,
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

function makeClient() {
  return {
    clearAuth: vi.fn<ConvexReactClient["clearAuth"]>(),
    setAuth: vi.fn<ConvexReactClient["setAuth"]>(),
  };
}

/** Starts one binding over fresh stores and returns its handles. */
const startBinding = Effect.fnUntraced(function* (
  initial: AuthSession,
  readToken: Effect.Effect<string, ConvexTokenReadError> = Effect.succeed(
    "token-1"
  )
) {
  const session = createStore(() => initial);
  const auth = createStore<ConvexAuth>(() => readInitialConvexAuth(initial));
  const client = makeClient();
  const fiber = yield* Effect.forkChild(
    bindConvexAuth({ auth, client, readToken, session })
  );
  yield* Effect.yieldNow;
  return { auth, client, fiber, session };
});

/** Returns the token fetcher and status callback of one setAuth call. */
function readBinding(client: ReturnType<typeof makeClient>, index: number) {
  const call = client.setAuth.mock.calls[index];
  if (call === undefined) {
    return expect.unreachable(`setAuth call ${index} is missing`);
  }
  const [fetchToken, onChange] = call;
  if (onChange === undefined) {
    return expect.unreachable(`setAuth call ${index} has no status callback`);
  }
  return { fetchToken, onChange };
}

describe("Convex authentication", () => {
  it.each([
    [pending, { isAuthenticated: false, isLoading: true }],
    [signedIn("session-1"), { isAuthenticated: false, isLoading: true }],
    [previewAuthSession, { isAuthenticated: false, isLoading: false }],
  ])("starts from the session the server rendered", (session, expected) => {
    expect(readInitialConvexAuth(session)).toStrictEqual(expected);
  });

  it.effect("settles a visitor without a session as signed out", () =>
    Effect.gen(function* () {
      const { auth, client, session } = yield* startBinding(pending);
      expect(auth.getState()).toStrictEqual({
        isAuthenticated: false,
        isLoading: true,
      });

      session.setState(previewAuthSession, true);

      expect(auth.getState()).toStrictEqual({
        isAuthenticated: false,
        isLoading: false,
      });
      expect(client.setAuth).not.toHaveBeenCalled();
      expect(client.clearAuth).not.toHaveBeenCalled();
    })
  );

  it.effect("authenticates a session once and follows Convex's answer", () =>
    Effect.gen(function* () {
      const { auth, client, session } = yield* startBinding(pending);

      session.setState(signedIn("session-1"), true);
      session.setState({ ...signedIn("session-1"), hasError: true }, true);

      expect(client.setAuth).toHaveBeenCalledTimes(1);
      expect(auth.getState().isLoading).toBe(true);
      readBinding(client, 0).onChange(true);
      expect(auth.getState()).toStrictEqual({
        isAuthenticated: true,
        isLoading: false,
      });
    })
  );

  it.effect("clears a replaced session and ignores its late confirmation", () =>
    Effect.gen(function* () {
      const { auth, client, session } = yield* startBinding(
        signedIn("session-1")
      );
      const first = readBinding(client, 0);

      session.setState(signedIn("session-2"), true);
      expect(client.clearAuth).toHaveBeenCalledTimes(1);
      expect(client.setAuth).toHaveBeenCalledTimes(2);

      first.onChange(true);
      expect(auth.getState().isLoading).toBe(true);

      session.setState(previewAuthSession, true);
      expect(client.clearAuth).toHaveBeenCalledTimes(2);
      readBinding(client, 1).onChange(true);
      expect(auth.getState()).toStrictEqual({
        isAuthenticated: false,
        isLoading: false,
      });

      session.setState(pending, true);
      expect(auth.getState()).toStrictEqual({
        isAuthenticated: false,
        isLoading: true,
      });
    })
  );

  it.effect("releases the session binding when it stops", () =>
    Effect.gen(function* () {
      const { client, fiber, session } = yield* startBinding(
        signedIn("session-1")
      );

      yield* Fiber.interrupt(fiber);
      expect(client.clearAuth).toHaveBeenCalledTimes(1);

      session.setState(signedIn("session-2"), true);
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
        const { client } = yield* startBinding(
          signedIn("session-1"),
          Effect.suspend(read)
        );
        const { fetchToken } = readBinding(client, 0);
        const fetch = (forceRefreshToken: boolean) =>
          Effect.promise(() => fetchToken({ forceRefreshToken }));

        expect(yield* fetch(false)).toBe("token-1");
        expect(yield* fetch(false)).toBe("token-1");
        expect(yield* fetch(true)).toBeNull();
        expect(yield* fetch(false)).toBe("token-2");
        expect(read).toHaveBeenCalledTimes(3);
      })
  );
});

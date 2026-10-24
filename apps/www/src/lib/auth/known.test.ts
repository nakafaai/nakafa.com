import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { reportClientException } from "@/lib/analytics/client";
import {
  expectSession,
  loadKnownSession,
  saveKnownSession,
} from "@/lib/auth/known";
import type { AuthSession } from "@/lib/auth/session";

const reportClientExceptionMock = vi.hoisted(() =>
  vi.fn<typeof reportClientException>(() => Effect.void)
);
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: reportClientExceptionMock,
}));

const signedOut = {
  hasError: false,
  isPending: false,
  sessionId: null,
  userId: null,
} satisfies AuthSession;

const signedIn = {
  ...signedOut,
  sessionId: "session-1",
  userId: "user-1",
} satisfies AuthSession;

/** What every key of account state in the browser starts with, which signing out clears. */
const ACCOUNT_KEY = /^nakafa-/u;

/** A storage the browser refuses to hand out or to use, as with storage turned off. */
const refusing = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  removeItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
};

describe("the session the browser last had", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it.effect("knows none before any session settled", () =>
    Effect.gen(function* () {
      expect(yield* loadKnownSession()).toBeNull();
    })
  );

  it.effect("keeps the id of a settled signed-in session", () =>
    Effect.gen(function* () {
      yield* saveKnownSession(signedIn);
      expect(yield* loadKnownSession()).toBe("session-1");
    })
  );

  it.effect("forgets it once Better Auth settles on signed out", () =>
    Effect.gen(function* () {
      yield* saveKnownSession(signedIn);
      yield* saveKnownSession(signedOut);
      expect(yield* loadKnownSession()).toBeNull();
    })
  );

  it.effect.each([
    { name: "a pending session", session: { ...signedOut, isPending: true } },
    {
      name: "a session request that failed",
      session: { ...signedOut, hasError: true },
    },
  ])("keeps what it knew through $name", ({ session }) =>
    Effect.gen(function* () {
      yield* saveKnownSession(signedIn);
      yield* saveKnownSession(session);
      expect(yield* loadKnownSession()).toBe("session-1");
    })
  );

  it.effect("expects a session while a sign-in is on its way", () =>
    Effect.gen(function* () {
      yield* expectSession();
      expect(yield* loadKnownSession()).not.toBeNull();
      // The sign-in was given up: Better Auth settles on signed out.
      yield* saveKnownSession(signedOut);
      expect(yield* loadKnownSession()).toBeNull();
    })
  );

  it.effect("shares the prefix that signing out clears", () =>
    Effect.gen(function* () {
      yield* saveKnownSession(signedIn);
      expect(window.localStorage.key(0)).toMatch(ACCOUNT_KEY);
    })
  );

  it.effect("knows nothing and keeps nothing where storage is refused", () =>
    Effect.gen(function* () {
      reportClientExceptionMock.mockClear();

      expect(yield* loadKnownSession(refusing)).toBeNull();
      yield* saveKnownSession(signedIn, refusing);
      yield* expectSession(refusing);
      expect(yield* loadKnownSession()).toBeNull();

      expect(
        reportClientExceptionMock.mock.calls.map(([, properties]) => properties)
      ).toEqual([
        { operation: "load", source: "auth.knownSession" },
        { operation: "save", source: "auth.knownSession" },
        { operation: "expect", source: "auth.knownSession" },
      ]);
    })
  );

  it.effect("knows nothing where the browser hands out no storage", () =>
    Effect.gen(function* () {
      reportClientExceptionMock.mockClear();
      vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
      expect(yield* loadKnownSession()).toBeNull();
      yield* saveKnownSession(signedIn);
      yield* expectSession();
      vi.restoreAllMocks();
      expect(yield* loadKnownSession()).toBeNull();

      expect(reportClientExceptionMock).toHaveBeenCalledWith(
        expect.anything(),
        { operation: "load", source: "auth.knownSession" }
      );
    })
  );
});

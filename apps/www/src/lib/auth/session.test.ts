import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  followAuthSession,
  holdSession,
  previewAuthSession,
  readAuthSession,
  releaseSession,
} from "@/lib/auth/session";

const signedIn = {
  session: { id: "session-1", token: "token", userId: "user-1" },
  user: { email: "learner@example.com", id: "user-1", name: "Learner" },
};

describe("Better Auth session", () => {
  it("reads the session Better Auth starts with as pending", () => {
    expect(
      readAuthSession({
        data: null,
        error: null,
        isPending: true,
        isRefetching: false,
      })
    ).toStrictEqual({
      hasError: false,
      isPending: true,
      sessionId: null,
      userId: null,
    });
  });

  it("reads a settled visitor without a session as signed out", () => {
    expect(
      readAuthSession({ data: null, error: null, isPending: false })
    ).toStrictEqual(previewAuthSession);
  });

  it("keeps only the session and user ids of a signed-in learner", () => {
    expect(
      readAuthSession({ data: signedIn, error: null, isPending: false })
    ).toStrictEqual({
      hasError: false,
      isPending: false,
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it("keeps the last session through a failed refresh and marks the error", () => {
    expect(
      readAuthSession({
        data: signedIn,
        error: { status: 500, statusText: "Internal Server Error" },
        isPending: false,
      })
    ).toStrictEqual({
      hasError: true,
      isPending: false,
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it.each([
    [{ message: "Failed to fetch" }],
    [{ status: 500, statusText: "Internal Server Error" }],
    [{ status: 503, statusText: "Service Unavailable" }],
  ])("keeps a first read that failed without an answer pending", (error) => {
    expect(
      readAuthSession({ data: null, error, isPending: false })
    ).toStrictEqual({
      hasError: true,
      isPending: true,
      sessionId: null,
      userId: null,
    });
  });

  it("reads a 401 as signed out, as Better Auth does", () => {
    expect(
      readAuthSession({
        data: null,
        error: { status: 401, statusText: "Unauthorized" },
        isPending: false,
      })
    ).toStrictEqual({
      hasError: true,
      isPending: false,
      sessionId: null,
      userId: null,
    });
  });

  it.each([
    undefined,
    { data: { session: {} }, error: null, isPending: false },
    { data: null, error: null },
  ])(
    "reads a value outside the session contract as a failed request",
    (value) => {
      expect(readAuthSession(value)).toStrictEqual({
        hasError: true,
        isPending: false,
        sessionId: null,
        userId: null,
      });
    }
  );
});

describe("Following Better Auth's session", () => {
  const refetch = {
    data: null,
    error: null,
    isPending: true,
    isRefetching: true,
  };

  it("keeps a settled signed-out session while Better Auth refetches it", () => {
    expect(followAuthSession(previewAuthSession, refetch)).toBe(
      previewAuthSession
    );
  });

  it("keeps a settled signed-out session through a refetch that fails without an answer", () => {
    expect(
      followAuthSession(previewAuthSession, {
        data: null,
        error: new TypeError("Failed to fetch"),
        isPending: false,
        isRefetching: false,
      })
    ).toBe(previewAuthSession);
  });

  it("stays pending through a first request that fails without an answer", () => {
    expect(
      followAuthSession(
        readAuthSession({
          data: null,
          error: null,
          isPending: true,
          isRefetching: false,
        }),
        {
          data: null,
          error: { status: 503, statusText: "Service Unavailable" },
          isPending: false,
          isRefetching: false,
        }
      )
    ).toStrictEqual({
      hasError: true,
      isPending: true,
      sessionId: null,
      userId: null,
    });
  });

  it("stays pending through the first request of an unsettled session", () => {
    expect(
      followAuthSession(
        readAuthSession({
          data: null,
          error: null,
          isPending: true,
          isRefetching: false,
        }),
        refetch
      )
    ).toStrictEqual({
      hasError: false,
      isPending: true,
      sessionId: null,
      userId: null,
    });
  });

  it.effect(
    "keeps the session readers see while the page signs out, and follows again once the sign-out failed",
    () =>
      Effect.gen(function* () {
        const shown = readAuthSession({
          data: signedIn,
          error: null,
          isPending: false,
        });
        const signedOut = { data: null, error: null, isPending: false };

        yield* holdSession();
        expect(followAuthSession(shown, signedOut)).toBe(shown);
        yield* releaseSession();
        expect(followAuthSession(shown, signedOut)).toStrictEqual({
          hasError: false,
          isPending: false,
          sessionId: null,
          userId: null,
        });
      })
  );

  it("takes the session the refetch answers with", () => {
    expect(
      followAuthSession(previewAuthSession, {
        data: signedIn,
        error: null,
        isPending: false,
        isRefetching: false,
      })
    ).toStrictEqual({
      hasError: false,
      isPending: false,
      sessionId: "session-1",
      userId: "user-1",
    });
  });
});

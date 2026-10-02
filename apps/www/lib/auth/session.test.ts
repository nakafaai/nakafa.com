import { describe, expect, it } from "@effect/vitest";
import { previewAuthSession, readAuthSession } from "@/lib/auth/session";

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

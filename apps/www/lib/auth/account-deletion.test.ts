import { analytics } from "@repo/analytics/posthog";
import { ACCOUNT_DELETION_ATTEMPT_HEADER } from "@repo/backend/convex/auth/deletion/constants";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountDeletionFailed,
  AccountDeletionSchoolMemberRequired,
  AccountDeletionSessionExpired,
  AccountReauthenticationFailed,
  clearDeletedAccountBrowserIdentity,
  deleteCurrentAccount,
  prepareAccountReauthentication,
} from "@/lib/auth/account-deletion";
import { authClient } from "@/lib/auth/client";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    deleteUser: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("@repo/analytics/posthog", () => ({
  analytics: {
    reset: vi.fn(),
    shutdown: vi.fn(async () => undefined),
  },
}));

describe("account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes when Better Auth deletes the account", async () => {
    vi.mocked(authClient.deleteUser).mockResolvedValue({
      data: { message: "User deleted", success: true },
      error: null,
    });

    await expect(
      Effect.runPromise(deleteCurrentAccount())
    ).resolves.toBeUndefined();
    expect(analytics.shutdown).not.toHaveBeenCalled();
    expect(authClient.deleteUser).toHaveBeenCalledWith({
      fetchOptions: {
        headers: {
          [ACCOUNT_DELETION_ATTEMPT_HEADER]: expect.any(String),
        },
      },
    });
  });

  it("does not clear the account for a non-terminal Better Auth response", async () => {
    const cancelPreparation = vi.fn(async () => undefined);
    const failure = await Effect.runPromise(
      deleteCurrentAccount({
        cancelPreparation,
        request: async () => ({
          data: { message: "Verification email sent", success: true },
          error: null,
        }),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(cancelPreparation).toHaveBeenCalledWith(expect.any(String));
  });

  it("clears browser identities after deletion", async () => {
    const flushAnalytics = vi.fn(async () => undefined);
    const removePersistedAccountState = vi.fn();
    const resetAnalytics = vi.fn();

    await Effect.runPromise(
      clearDeletedAccountBrowserIdentity({
        flushAnalytics,
        removePersistedAccountState,
        resetAnalytics,
      })
    );

    expect(flushAnalytics).toHaveBeenCalledOnce();
    expect(removePersistedAccountState).toHaveBeenCalledOnce();
    expect(resetAnalytics).toHaveBeenCalledOnce();
    expect(flushAnalytics.mock.invocationCallOrder[0]).toBeLessThan(
      resetAnalytics.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("clears analytics and every Nakafa-prefixed account store", async () => {
    window.localStorage.setItem("nakafa-ai", "test-ai-state");
    window.localStorage.setItem(
      "nakafa-content-views",
      "test-content-view-state"
    );
    window.localStorage.setItem("nakafa-device-id", "test-device");
    window.localStorage.setItem("nakafa-school-layout", "test-layout");
    window.localStorage.setItem("unrelated", "preserved");
    window.sessionStorage.setItem("nakafa-search", "test-search");
    window.sessionStorage.setItem(
      "nakafa-forum-session:class-1",
      "test-forum-session"
    );
    window.sessionStorage.setItem("unrelated", "preserved");

    await Effect.runPromise(clearDeletedAccountBrowserIdentity());

    expect(analytics.shutdown).toHaveBeenCalledOnce();
    expect(analytics.reset).toHaveBeenCalledWith(true);
    expect(
      vi.mocked(analytics.shutdown).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(analytics.reset).mock.invocationCallOrder[0] ?? 0);
    expect(window.localStorage.getItem("nakafa-ai")).toBeNull();
    expect(window.localStorage.getItem("nakafa-content-views")).toBeNull();
    expect(window.localStorage.getItem("nakafa-device-id")).toBeNull();
    expect(window.localStorage.getItem("nakafa-school-layout")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("preserved");
    expect(window.sessionStorage.getItem("nakafa-search")).toBeNull();
    expect(
      window.sessionStorage.getItem("nakafa-forum-session:class-1")
    ).toBeNull();
    expect(window.sessionStorage.getItem("unrelated")).toBe("preserved");
  });

  it("does not fail a completed deletion when browser cleanup fails", async () => {
    await expect(
      Effect.runPromise(
        clearDeletedAccountBrowserIdentity({
          flushAnalytics: () =>
            Promise.reject(new Error("analytics queue unavailable")),
          removePersistedAccountState: () => {
            throw new Error("storage unavailable");
          },
          resetAnalytics: () => {
            throw new Error("analytics unavailable");
          },
        })
      )
    ).resolves.toBeUndefined();
  });

  it("returns a typed stale-session failure", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount({
        request: async () => ({
          data: null,
          error: {
            code: "SESSION_EXPIRED",
            message: "Session expired",
            status: 400,
            statusText: "BAD_REQUEST",
          },
        }),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
  });

  it("returns a typed failure for other delete errors", async () => {
    const cancelPreparation = vi.fn(async () => undefined);
    const failure = await Effect.runPromise(
      deleteCurrentAccount({
        cancelPreparation,
        request: async () => ({
          data: null,
          error: {
            code: "DELETE_FAILED",
            message: "Delete failed",
            status: 500,
            statusText: "INTERNAL_SERVER_ERROR",
          },
        }),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(cancelPreparation).toHaveBeenCalledWith(expect.any(String));
  });

  it("returns a typed failure when an owned school needs a successor", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount({
        request: async () => ({
          data: null,
          error: {
            code: "ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER",
            message: "An owned school needs another active member.",
            status: 400,
            statusText: "BAD_REQUEST",
          },
        }),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
  });

  it("preserves a server failure when immediate cancellation also fails", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount({
        cancelPreparation: () =>
          Promise.reject(new Error("cancellation unavailable")),
        request: async () => ({
          data: null,
          error: {
            code: "DELETE_FAILED",
            message: "Delete failed",
            status: 500,
            statusText: "INTERNAL_SERVER_ERROR",
          },
        }),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
  });

  it("leaves uncertain transport failures to durable server recovery", async () => {
    const cancelPreparation = vi.fn(() =>
      Promise.reject(new Error("cancellation unavailable"))
    );
    const failure = await Effect.runPromise(
      deleteCurrentAccount({
        cancelPreparation,
        request: () => Promise.reject(new Error("network unavailable")),
      }).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: expect.any(String),
    });
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("clears the current session before reauthentication", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    await expect(
      Effect.runPromise(prepareAccountReauthentication())
    ).resolves.toBeUndefined();
  });

  it("returns a typed failure when sign-out is rejected", async () => {
    const failure = await Effect.runPromise(
      prepareAccountReauthentication(async () => ({
        data: null,
        error: {
          code: "SIGN_OUT_FAILED",
          message: "Sign-out failed",
          status: 500,
          statusText: "INTERNAL_SERVER_ERROR",
        },
      })).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountReauthenticationFailed);
  });

  it("returns a typed failure when sign-out cannot start", async () => {
    const failure = await Effect.runPromise(
      prepareAccountReauthentication(() =>
        Promise.reject(new Error("network unavailable"))
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountReauthenticationFailed);
  });
});

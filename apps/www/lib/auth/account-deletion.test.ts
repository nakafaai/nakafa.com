import { analytics } from "@repo/analytics/posthog";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import { accountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountDeletionFailed,
  AccountDeletionSchoolMemberRequired,
  AccountDeletionSessionExpired,
  AccountReauthenticationFailed,
  accountDeletionRequestPhase,
  clearDeletedAccountBrowserIdentity,
  deleteCurrentAccount,
  prepareAccountReauthentication,
} from "@/lib/auth/account-deletion";

type AccountDeletionOperations = Parameters<typeof deleteCurrentAccount>[0];

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

const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

function createDeletionOperations(
  overrides: Partial<AccountDeletionOperations> = {}
): AccountDeletionOperations {
  return {
    attemptId: ATTEMPT_ID,
    cancelPreparation: vi.fn(async () => undefined),
    prepare: vi.fn(async () => accountDeletionPreparationOutcome.ready),
    startPhase: accountDeletionRequestPhase.preparation,
    ...overrides,
  };
}

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
      Effect.runPromise(deleteCurrentAccount(createDeletionOperations()))
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
      deleteCurrentAccount(
        createDeletionOperations({
          cancelPreparation,
          request: async () => ({
            data: { message: "Verification email sent", success: true },
            error: null,
          }),
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(cancelPreparation).toHaveBeenCalledWith(expect.any(String));
  });

  it("drains bounded preparation requests before deleting auth", async () => {
    const prepare = vi
      .fn<AccountDeletionOperations["prepare"]>()
      .mockResolvedValueOnce(accountDeletionPreparationOutcome.continue)
      .mockResolvedValueOnce(accountDeletionPreparationOutcome.continue)
      .mockResolvedValueOnce(accountDeletionPreparationOutcome.ready);
    const request = vi.fn(async () => ({
      data: { message: "User deleted", success: true },
      error: null,
    }));

    await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          prepare,
          request,
        })
      )
    );

    expect(prepare).toHaveBeenCalledTimes(3);
    expect(prepare).toHaveBeenNthCalledWith(1, ATTEMPT_ID);
    expect(request).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
  });

  it("preserves a preparation attempt after an uncertain request", async () => {
    const cancelPreparation = vi.fn(async () => undefined);
    const request = vi.fn();
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          cancelPreparation,
          prepare: () =>
            Promise.reject(new Error("preparation response unavailable")),
          request,
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
    });
    expect(request).not.toHaveBeenCalled();
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("skips completed preparation when retrying an uncertain auth delete", async () => {
    const prepare = vi.fn(async () => accountDeletionPreparationOutcome.ready);
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          prepare,
          request: async () => ({
            data: null,
            error: {
              code: "SESSION_EXPIRED",
              message: "Session expired",
              status: 400,
              statusText: "BAD_REQUEST",
            },
          }),
          startPhase: accountDeletionRequestPhase.deletion,
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("continues preparation when the auth safety check is not ready", async () => {
    const cancelPreparation = vi.fn(async () => undefined);
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          cancelPreparation,
          request: async () => ({
            data: null,
            error: {
              code: ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
              message: "Account deletion preparation is incomplete.",
              status: 400,
              statusText: "BAD_REQUEST",
            },
          }),
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
    });
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("stops before auth deletion when preparation needs a successor", async () => {
    const request = vi.fn();
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          prepare: vi.fn(
            async () =>
              accountDeletionPreparationOutcome.schoolSuccessorRequired
          ),
          request,
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
    expect(request).not.toHaveBeenCalled();
  });

  it("cancels a preparation that cannot safely continue", async () => {
    const cancelPreparation = vi.fn(async () => undefined);
    const request = vi.fn();
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          cancelPreparation,
          prepare: vi.fn(
            async () => accountDeletionPreparationOutcome.temporarilyUnavailable
          ),
          request,
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(request).not.toHaveBeenCalled();
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
      deleteCurrentAccount(
        createDeletionOperations({
          request: async () => ({
            data: null,
            error: {
              code: "SESSION_EXPIRED",
              message: "Session expired",
              status: 400,
              statusText: "BAD_REQUEST",
            },
          }),
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
  });

  it("returns a typed failure for other delete errors", async () => {
    const cancelPreparation = vi.fn(async () => undefined);
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
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
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(cancelPreparation).toHaveBeenCalledWith(expect.any(String));
  });

  it("returns a typed failure when an owned school needs a successor", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          request: async () => ({
            data: null,
            error: {
              code: "ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER",
              message: "An owned school needs another active member.",
              status: 400,
              statusText: "BAD_REQUEST",
            },
          }),
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
  });

  it("preserves a server failure when immediate cancellation also fails", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
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
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
  });

  it("leaves uncertain transport failures to durable server recovery", async () => {
    const cancelPreparation = vi.fn(() =>
      Promise.reject(new Error("cancellation unavailable"))
    );
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          cancelPreparation,
          request: () => Promise.reject(new Error("network unavailable")),
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: expect.any(String),
      phase: accountDeletionRequestPhase.deletion,
    });
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("clears browser identity before reauthentication", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({
      data: { success: true },
      error: null,
    });
    window.localStorage.setItem("nakafa-ai", "deleted-account-chat");
    window.sessionStorage.setItem(
      "nakafa-forum-session:class-1",
      "deleted-account-forum"
    );

    await expect(
      Effect.runPromise(prepareAccountReauthentication())
    ).resolves.toBeUndefined();

    expect(window.localStorage.getItem("nakafa-ai")).toBeNull();
    expect(
      window.sessionStorage.getItem("nakafa-forum-session:class-1")
    ).toBeNull();
    expect(analytics.shutdown).toHaveBeenCalledOnce();
    expect(analytics.reset).toHaveBeenCalledWith(true);
    expect(authClient.signOut).toHaveBeenCalledOnce();
    expect(
      vi.mocked(analytics.shutdown).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(authClient.signOut).mock.invocationCallOrder[0] ?? 0
    );
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

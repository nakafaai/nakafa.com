import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  accountDeletionAttemptStatus,
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountDeletionFailed,
  AccountDeletionRequestUncertain,
  AccountDeletionSchoolMemberRequired,
  AccountDeletionSessionExpired,
  deleteCurrentAccount,
} from "@/lib/auth/account-deletion";
import { AccountDeletionAttemptStorageFailed } from "@/lib/auth/account-deletion-attempt";

type AccountDeletionOperations = Parameters<typeof deleteCurrentAccount>[0];

import { authClient } from "@/lib/auth/client";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    deleteUser: vi.fn(),
    signOut: vi.fn(),
  },
}));

const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const USER_ID = "user-1";
const STORAGE_FAILED_CODE = "ACCOUNT_DELETION_ATTEMPT_STORAGE_FAILED";

function createDeletionOperations(
  overrides: Partial<AccountDeletionOperations> = {}
): AccountDeletionOperations {
  return {
    attempt: {
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
      userId: USER_ID,
    },
    cancelPreparation: vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    ),
    persist: vi.fn(() => Effect.void),
    prepare: vi.fn(async () => accountDeletionPreparationOutcome.ready),
    reconcile: vi.fn(async () => accountDeletionAttemptStatus.pending),
    ...overrides,
  };
}

function requestFailure(code: string, status = 400) {
  return async () => ({
    data: null,
    error: {
      code,
      message: code,
      status,
      statusText: "ERROR",
    },
  });
}

function runDeletionFailure(overrides: Partial<AccountDeletionOperations>) {
  return Effect.runPromise(
    deleteCurrentAccount(createDeletionOperations(overrides)).pipe(Effect.flip)
  );
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
    expect(authClient.deleteUser).toHaveBeenCalledWith({
      fetchOptions: {
        headers: {
          [ACCOUNT_DELETION_ATTEMPT_HEADER]: expect.any(String),
        },
      },
    });
  });

  it("does not clear the account for a non-terminal Better Auth response", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
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
    const persist = vi.fn(() => Effect.void);
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
          persist,
          prepare,
          request,
        })
      )
    );

    expect(prepare).toHaveBeenCalledTimes(3);
    expect(prepare).toHaveBeenNthCalledWith(1, ATTEMPT_ID);
    expect(persist).toHaveBeenCalledExactlyOnceWith({
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.deletion,
      userId: USER_ID,
    });
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(
      request.mock.invocationCallOrder[0] ?? 0
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
  });

  it("continues a browser-persisted preparation after a page reload", async () => {
    const persistedAttemptId = "019fa44c-02be-7cd0-a4ed-61a7af8e0621";
    const prepare = vi.fn(async () => accountDeletionPreparationOutcome.ready);
    const request = vi.fn(async () => ({
      data: { message: "User deleted", success: true },
      error: null,
    }));

    await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          attempt: {
            attemptId: persistedAttemptId,
            phase: accountDeletionRequestPhase.preparation,
            userId: USER_ID,
          },
          prepare,
          request,
        })
      )
    );

    expect(prepare).toHaveBeenCalledExactlyOnceWith(persistedAttemptId);
    expect(request).toHaveBeenCalledExactlyOnceWith(persistedAttemptId);
  });

  it("cancels before deletion when its durable phase cannot be saved", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const prepare = vi.fn(async () => accountDeletionPreparationOutcome.ready);
    const request = vi.fn();
    const failure = await runDeletionFailure({
      cancelPreparation,
      persist: () =>
        Effect.fail(
          new AccountDeletionAttemptStorageFailed({
            code: STORAGE_FAILED_CODE,
          })
        ),
      prepare,
      request,
    });

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(prepare).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(request).not.toHaveBeenCalled();
  });

  it("preserves a preparation attempt after an uncertain request", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
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
    const failure = await runDeletionFailure({
      prepare,
      request: requestFailure("SESSION_EXPIRED"),
      attempt: {
        attemptId: ATTEMPT_ID,
        phase: accountDeletionRequestPhase.deletion,
        userId: USER_ID,
      },
    });

    expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("completes a retry from its durable commit receipt", async () => {
    const prepare = vi.fn(async () => accountDeletionPreparationOutcome.ready);
    const request = vi.fn();

    await expect(
      Effect.runPromise(
        deleteCurrentAccount(
          createDeletionOperations({
            prepare,
            reconcile: vi.fn(
              async () => accountDeletionAttemptStatus.committed
            ),
            request,
            attempt: {
              attemptId: ATTEMPT_ID,
              phase: accountDeletionRequestPhase.deletion,
              userId: USER_ID,
            },
          })
        )
      )
    ).resolves.toBeUndefined();
    expect(prepare).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("recovers when the delete response is lost after commit", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );

    await expect(
      Effect.runPromise(
        deleteCurrentAccount(
          createDeletionOperations({
            cancelPreparation,
            reconcile: vi.fn(
              async () => accountDeletionAttemptStatus.committed
            ),
            request: () => Promise.reject(new Error("response unavailable")),
          })
        )
      )
    ).resolves.toBeUndefined();
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("proves a lost success before accepting an unauthorized retry", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const reconcile = vi
      .fn<AccountDeletionOperations["reconcile"]>()
      .mockResolvedValueOnce(accountDeletionAttemptStatus.pending)
      .mockResolvedValueOnce(accountDeletionAttemptStatus.committed);

    await expect(
      Effect.runPromise(
        deleteCurrentAccount(
          createDeletionOperations({
            cancelPreparation,
            reconcile,
            request: requestFailure("UNAUTHORIZED", 401),
            attempt: {
              attemptId: ATTEMPT_ID,
              phase: accountDeletionRequestPhase.deletion,
              userId: USER_ID,
            },
          })
        )
      )
    ).resolves.toBeUndefined();
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("keeps a deletion retry uncertain when proof is unavailable", async () => {
    const request = vi.fn();
    const failure = await Effect.runPromise(
      deleteCurrentAccount(
        createDeletionOperations({
          reconcile: () => Promise.reject(new Error("proof unavailable")),
          request,
          attempt: {
            attemptId: ATTEMPT_ID,
            phase: accountDeletionRequestPhase.deletion,
            userId: USER_ID,
          },
        })
      ).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.deletion,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("continues preparation when the auth safety check is not ready", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const persist = vi.fn(() => Effect.void);
    const failure = await runDeletionFailure({
      cancelPreparation,
      persist,
      request: requestFailure(ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE),
    });

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
    });
    expect(cancelPreparation).not.toHaveBeenCalled();
    expect(persist).toHaveBeenLastCalledWith({
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
      userId: USER_ID,
    });
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
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
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

  it("returns a typed stale-session failure", async () => {
    const failure = await runDeletionFailure({
      request: requestFailure("SESSION_EXPIRED"),
    });

    expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
  });

  it("drains cancellation before resetting a stale-session attempt", async () => {
    const cancelPreparation = vi
      .fn<AccountDeletionOperations["cancelPreparation"]>()
      .mockResolvedValueOnce(accountDeletionCancellationOutcome.continue)
      .mockResolvedValueOnce(accountDeletionCancellationOutcome.complete);
    const failure = await runDeletionFailure({
      cancelPreparation,
      request: requestFailure("SESSION_EXPIRED"),
    });

    expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
    expect(cancelPreparation).toHaveBeenCalledTimes(2);
    expect(cancelPreparation).toHaveBeenNthCalledWith(1, ATTEMPT_ID);
    expect(cancelPreparation).toHaveBeenNthCalledWith(2, ATTEMPT_ID);
  });

  it("leaves other delete errors to durable server recovery", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const failure = await runDeletionFailure({
      cancelPreparation,
      request: requestFailure("DELETE_FAILED", 500),
    });

    expect(failure).toBeInstanceOf(AccountDeletionRequestUncertain);
    expect(failure).toMatchObject({
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.deletion,
    });
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("returns a typed failure when an owned school needs a successor", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const persist = vi.fn(() => Effect.void);
    const failure = await runDeletionFailure({
      cancelPreparation,
      persist,
      request: requestFailure("ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER"),
    });

    expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
    expect(cancelPreparation).not.toHaveBeenCalled();
    expect(persist).toHaveBeenLastCalledWith({
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
      userId: USER_ID,
    });
  });

  it("preserves the attempt when immediate cancellation also fails", async () => {
    const failure = await runDeletionFailure({
      cancelPreparation: () =>
        Promise.reject(new Error("cancellation unavailable")),
      request: requestFailure("SESSION_EXPIRED"),
    });

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.deletion,
    });
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
});

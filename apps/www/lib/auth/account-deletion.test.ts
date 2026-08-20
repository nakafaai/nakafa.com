import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  accountDeletionAttemptStatus,
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCurrentAccount } from "@/lib/auth/account-deletion";
import {
  AccountDeletionFailed,
  AccountDeletionRequestUncertain,
  AccountDeletionSchoolMemberRequired,
  AccountDeletionSessionExpired,
} from "@/lib/auth/account-deletion-errors";

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
    clearAttempt: Effect.void,
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

  it("cancels before retrying when the auth safety check is not ready", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const clearAttempt = vi.fn();
    const failure = await runDeletionFailure({
      cancelPreparation,
      clearAttempt: Effect.sync(clearAttempt),
      request: requestFailure(ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE),
    });

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
    });
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(clearAttempt).toHaveBeenCalledOnce();
  });

  it("rotates an attempt canceled by background recovery", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const clearAttempt = vi.fn();
    const failure = await runDeletionFailure({
      attempt: {
        attemptId: ATTEMPT_ID,
        phase: accountDeletionRequestPhase.deletion,
        userId: USER_ID,
      },
      cancelPreparation,
      clearAttempt: Effect.sync(clearAttempt),
      request: requestFailure(ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE),
    });

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
    });
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(clearAttempt).toHaveBeenCalledOnce();
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
    const clearAttempt = vi.fn();
    const failure = await runDeletionFailure({
      cancelPreparation,
      clearAttempt: Effect.sync(clearAttempt),
      request: requestFailure("ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER"),
    });

    expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(clearAttempt).toHaveBeenCalledOnce();
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

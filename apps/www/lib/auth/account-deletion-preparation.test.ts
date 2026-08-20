import {
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { AccountDeletionAttemptStorageFailed } from "@/lib/auth/account-deletion-attempt";
import {
  AccountDeletionFailed,
  AccountDeletionSchoolMemberRequired,
} from "@/lib/auth/account-deletion-errors";
import { prepareAccountDeletion } from "@/lib/auth/account-deletion-preparation";

type AccountDeletionPreparationOperations = Parameters<
  typeof prepareAccountDeletion
>[0];

const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const USER_ID = "user-1";
const STORAGE_FAILED_CODE = "ACCOUNT_DELETION_ATTEMPT_STORAGE_FAILED";

function createPreparationOperations(
  overrides: Partial<AccountDeletionPreparationOperations> = {}
): AccountDeletionPreparationOperations {
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
    ...overrides,
  };
}

function runPreparationFailure(
  overrides: Partial<AccountDeletionPreparationOperations>
) {
  return Effect.runPromise(
    prepareAccountDeletion(createPreparationOperations(overrides)).pipe(
      Effect.flip
    )
  );
}

describe("account deletion preparation", () => {
  it("drains every bounded preparation request before persisting deletion", async () => {
    const persist = vi.fn(() => Effect.void);
    const prepare = vi
      .fn<AccountDeletionPreparationOperations["prepare"]>()
      .mockResolvedValueOnce(accountDeletionPreparationOutcome.continue)
      .mockResolvedValueOnce(accountDeletionPreparationOutcome.continue)
      .mockResolvedValueOnce(accountDeletionPreparationOutcome.ready);

    await Effect.runPromise(
      prepareAccountDeletion(
        createPreparationOperations({
          persist,
          prepare,
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
    expect(prepare.mock.invocationCallOrder[2]).toBeLessThan(
      persist.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("continues the browser-persisted attempt after a page reload", async () => {
    const persistedAttemptId = "019fa44c-02be-7cd0-a4ed-61a7af8e0621";
    const prepare = vi.fn(async () => accountDeletionPreparationOutcome.ready);

    await Effect.runPromise(
      prepareAccountDeletion(
        createPreparationOperations({
          attempt: {
            attemptId: persistedAttemptId,
            phase: accountDeletionRequestPhase.preparation,
            userId: USER_ID,
          },
          prepare,
        })
      )
    );

    expect(prepare).toHaveBeenCalledExactlyOnceWith(persistedAttemptId);
  });

  it("cancels before deletion when its durable phase cannot be saved", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const prepare = vi.fn(async () => accountDeletionPreparationOutcome.ready);
    const failure = await runPreparationFailure({
      cancelPreparation,
      persist: () =>
        Effect.fail(
          new AccountDeletionAttemptStorageFailed({
            code: STORAGE_FAILED_CODE,
          })
        ),
      prepare,
    });

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(prepare).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
  });

  it("preserves the attempt when the preparation response is uncertain", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const failure = await runPreparationFailure({
      cancelPreparation,
      prepare: () =>
        Promise.reject(new Error("preparation response unavailable")),
    });

    expect(failure).toMatchObject({
      _tag: "AccountDeletionRequestUncertain",
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.preparation,
    });
    expect(cancelPreparation).not.toHaveBeenCalled();
  });

  it("cancels when an owned school needs a successor", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const clearAttempt = vi.fn();
    const failure = await runPreparationFailure({
      cancelPreparation,
      clearAttempt: Effect.sync(clearAttempt),
      prepare: vi.fn(
        async () => accountDeletionPreparationOutcome.schoolSuccessorRequired
      ),
    });

    expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(clearAttempt).toHaveBeenCalledOnce();
  });

  it("cancels a preparation that cannot safely continue", async () => {
    const cancelPreparation = vi.fn(
      async () => accountDeletionCancellationOutcome.complete
    );
    const clearAttempt = vi.fn();
    const failure = await runPreparationFailure({
      cancelPreparation,
      clearAttempt: Effect.sync(clearAttempt),
      prepare: vi.fn(
        async () => accountDeletionPreparationOutcome.temporarilyUnavailable
      ),
    });

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
    expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
    expect(clearAttempt).toHaveBeenCalledOnce();
  });

  it("fails closed when a canceled browser capability cannot be removed", async () => {
    const failure = await runPreparationFailure({
      clearAttempt: Effect.fail(
        new AccountDeletionAttemptStorageFailed({
          code: STORAGE_FAILED_CODE,
        })
      ),
      prepare: vi.fn(
        async () => accountDeletionPreparationOutcome.temporarilyUnavailable
      ),
    });

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
  });
});

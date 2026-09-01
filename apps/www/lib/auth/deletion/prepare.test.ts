import { describe, expect, it } from "@effect/vitest";
import {
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";
import { AccountDeletionAttemptStorageFailed } from "@/lib/auth/deletion/attempt";
import {
  AccountDeletionFailed,
  AccountDeletionSchoolMemberRequired,
} from "@/lib/auth/deletion/errors";
import { prepareAccountDeletion } from "@/lib/auth/deletion/prepare";

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
    cancelPreparation: vi.fn(() =>
      Promise.resolve(accountDeletionCancellationOutcome.complete)
    ),
    clearAttempt: Effect.void,
    persist: vi.fn(() => Effect.void),
    prepare: vi.fn(() =>
      Promise.resolve(accountDeletionPreparationOutcome.ready)
    ),
    ...overrides,
  };
}

function preparationFailure(
  overrides: Partial<AccountDeletionPreparationOperations>
) {
  return prepareAccountDeletion(createPreparationOperations(overrides)).pipe(
    Effect.flip
  );
}

describe("account deletion preparation", () => {
  it.effect(
    "drains every bounded preparation request before persisting deletion",
    () =>
      Effect.gen(function* () {
        const persist = vi.fn(() => Effect.void);
        const prepare = vi
          .fn<AccountDeletionPreparationOperations["prepare"]>()
          .mockResolvedValueOnce(accountDeletionPreparationOutcome.continue)
          .mockResolvedValueOnce(accountDeletionPreparationOutcome.continue)
          .mockResolvedValueOnce(accountDeletionPreparationOutcome.ready);

        yield* prepareAccountDeletion(
          createPreparationOperations({
            persist,
            prepare,
          })
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
      })
  );

  it.effect("continues the browser-persisted attempt after a page reload", () =>
    Effect.gen(function* () {
      const persistedAttemptId = "019fa44c-02be-7cd0-a4ed-61a7af8e0621";
      const prepare = vi.fn(() =>
        Promise.resolve(accountDeletionPreparationOutcome.ready)
      );

      yield* prepareAccountDeletion(
        createPreparationOperations({
          attempt: {
            attemptId: persistedAttemptId,
            phase: accountDeletionRequestPhase.preparation,
            userId: USER_ID,
          },
          prepare,
        })
      );

      expect(prepare).toHaveBeenCalledExactlyOnceWith(persistedAttemptId);
    })
  );

  it.effect(
    "cancels before deletion when its durable phase cannot be saved",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi.fn(() =>
          Promise.resolve(accountDeletionCancellationOutcome.complete)
        );
        const prepare = vi.fn(() =>
          Promise.resolve(accountDeletionPreparationOutcome.ready)
        );
        const failure = yield* preparationFailure({
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
      })
  );

  it.effect(
    "preserves the attempt when the preparation response is uncertain",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi.fn(() =>
          Promise.resolve(accountDeletionCancellationOutcome.complete)
        );
        const failure = yield* preparationFailure({
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
      })
  );

  it.effect("cancels when an owned school needs a successor", () =>
    Effect.gen(function* () {
      const cancelPreparation = vi.fn(() =>
        Promise.resolve(accountDeletionCancellationOutcome.complete)
      );
      const clearAttempt = vi.fn();
      const failure = yield* preparationFailure({
        cancelPreparation,
        clearAttempt: Effect.sync(clearAttempt),
        prepare: vi.fn(() =>
          Promise.resolve(
            accountDeletionPreparationOutcome.schoolSuccessorRequired
          )
        ),
      });

      expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
      expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
      expect(clearAttempt).toHaveBeenCalledOnce();
    })
  );

  it.effect("cancels a preparation that cannot safely continue", () =>
    Effect.gen(function* () {
      const cancelPreparation = vi.fn(() =>
        Promise.resolve(accountDeletionCancellationOutcome.complete)
      );
      const clearAttempt = vi.fn();
      const failure = yield* preparationFailure({
        cancelPreparation,
        clearAttempt: Effect.sync(clearAttempt),
        prepare: vi.fn(() =>
          Promise.resolve(
            accountDeletionPreparationOutcome.temporarilyUnavailable
          )
        ),
      });

      expect(failure).toBeInstanceOf(AccountDeletionFailed);
      expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
      expect(clearAttempt).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "fails closed when a canceled browser capability cannot be removed",
    () =>
      Effect.gen(function* () {
        const failure = yield* preparationFailure({
          clearAttempt: Effect.fail(
            new AccountDeletionAttemptStorageFailed({
              code: STORAGE_FAILED_CODE,
            })
          ),
          prepare: vi.fn(() =>
            Promise.resolve(
              accountDeletionPreparationOutcome.temporarilyUnavailable
            )
          ),
        });

        expect(failure).toBeInstanceOf(AccountDeletionFailed);
      })
  );
});

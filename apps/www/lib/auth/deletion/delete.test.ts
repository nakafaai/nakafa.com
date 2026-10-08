import { beforeEach, describe, expect, it } from "@effect/vitest";
import { UserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_ATTEMPT_HEADER,
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/confect/auth/deletion/constants";
import {
  type AccountDeletionBrowserAttempt,
  accountDeletionAttemptStatus,
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
  accountDeletionRequestPhase,
} from "@repo/backend/confect/auth/deletion/spec";
import { Effect, Result } from "effect";
import { authClient } from "@/lib/auth/client";
import {
  type DeleteUserRequest,
  deleteCurrentAccount,
  type ReconcileAccountDeletionRequest,
} from "@/lib/auth/deletion/delete";
import {
  AccountDeletionFailed,
  AccountDeletionRequestUncertain,
  AccountDeletionSchoolMemberRequired,
  AccountDeletionSessionExpired,
} from "@/lib/auth/deletion/errors";
import type {
  CancelAccountDeletionRequest,
  ClearAccountDeletionAttempt,
  PersistAccountDeletionAttempt,
  PrepareAccountDeletionRequest,
} from "@/lib/auth/deletion/prepare";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    deleteUser: vi.fn(),
    signOut: vi.fn(),
  },
}));
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const USER_ID = "user-1";
/** The default browser operations; each test overrides only what it observes. */
function defaultDeletionOperations() {
  const attempt: AccountDeletionBrowserAttempt = {
    attemptId: ATTEMPT_ID,
    phase: accountDeletionRequestPhase.preparation,
    userId: USER_ID,
  };
  const cancelPreparation: CancelAccountDeletionRequest = vi.fn(() =>
    Promise.resolve(Result.succeed(accountDeletionCancellationOutcome.complete))
  );
  const clearAttempt: ClearAccountDeletionAttempt = Effect.void;
  const persist: PersistAccountDeletionAttempt = vi.fn(() => Effect.void);
  const prepare: PrepareAccountDeletionRequest = vi.fn(() =>
    Promise.resolve(Result.succeed(accountDeletionPreparationOutcome.ready))
  );
  const reconcile: ReconcileAccountDeletionRequest = vi.fn(() =>
    Effect.succeed(accountDeletionAttemptStatus.pending)
  );
  return {
    attempt,
    cancelPreparation,
    clearAttempt,
    persist,
    prepare,
    reconcile,
  };
}
type DeletionOperations = ReturnType<typeof defaultDeletionOperations> &
  Partial<Record<"request", DeleteUserRequest>>;
function createDeletionOperations(
  overrides: Partial<DeletionOperations> = {}
): DeletionOperations {
  return { ...defaultDeletionOperations(), ...overrides };
}
/** Passes one operations bag to deleteCurrentAccount's positional parameters. */
function runDeletion(operations: DeletionOperations) {
  return deleteCurrentAccount(
    operations.attempt,
    operations.cancelPreparation,
    operations.clearAttempt,
    operations.persist,
    operations.prepare,
    operations.reconcile,
    operations.request
  );
}
function requestFailure(code: string, status = 400) {
  return () =>
    Promise.resolve({
      data: null,
      error: {
        code,
        message: code,
        status,
        statusText: "ERROR",
      },
    });
}
function deletionFailure(overrides: Partial<DeletionOperations>) {
  return runDeletion(createDeletionOperations(overrides)).pipe(Effect.flip);
}
describe("account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it.effect("completes when Better Auth deletes the account", () =>
    Effect.gen(function* () {
      vi.mocked(authClient.deleteUser).mockResolvedValue({
        data: {
          message: "User deleted",
          success: true,
        },
        error: null,
      });
      expect(yield* runDeletion(createDeletionOperations())).toBeUndefined();
      expect(authClient.deleteUser).toHaveBeenCalledWith({
        fetchOptions: {
          headers: {
            [ACCOUNT_DELETION_ATTEMPT_HEADER]: expect.any(String),
          },
        },
      });
    })
  );
  it.effect(
    "does not clear the account for a non-terminal Better Auth response",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi.fn(() =>
          Promise.resolve(
            Result.succeed(accountDeletionCancellationOutcome.complete)
          )
        );
        const failure = yield* runDeletion(
          createDeletionOperations({
            cancelPreparation,
            request: () =>
              Promise.resolve({
                data: {
                  message: "Verification email sent",
                  success: true,
                },
                error: null,
              }),
          })
        ).pipe(Effect.flip);
        expect(failure).toBeInstanceOf(AccountDeletionFailed);
        expect(cancelPreparation).toHaveBeenCalledWith(expect.any(String));
      })
  );
  it.effect(
    "skips completed preparation when retrying an uncertain auth delete",
    () =>
      Effect.gen(function* () {
        const prepare = vi.fn(() =>
          Promise.resolve(
            Result.succeed(accountDeletionPreparationOutcome.ready)
          )
        );
        const failure = yield* deletionFailure({
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
      })
  );
  it.effect("completes a retry from its durable commit receipt", () =>
    Effect.gen(function* () {
      const prepare = vi.fn(() =>
        Promise.resolve(Result.succeed(accountDeletionPreparationOutcome.ready))
      );
      const request = vi.fn();
      expect(
        yield* runDeletion(
          createDeletionOperations({
            prepare,
            reconcile: vi.fn(() =>
              Effect.succeed(accountDeletionAttemptStatus.committed)
            ),
            request,
            attempt: {
              attemptId: ATTEMPT_ID,
              phase: accountDeletionRequestPhase.deletion,
              userId: USER_ID,
            },
          })
        )
      ).toBeUndefined();
      expect(prepare).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
    })
  );
  it.effect("recovers when the delete response is lost after commit", () =>
    Effect.gen(function* () {
      const cancelPreparation = vi.fn(() =>
        Promise.resolve(
          Result.succeed(accountDeletionCancellationOutcome.complete)
        )
      );
      expect(
        yield* runDeletion(
          createDeletionOperations({
            cancelPreparation,
            reconcile: vi.fn(() =>
              Effect.succeed(accountDeletionAttemptStatus.committed)
            ),
            request: () => Promise.reject(new Error("response unavailable")),
          })
        )
      ).toBeUndefined();
      expect(cancelPreparation).not.toHaveBeenCalled();
    })
  );
  it.effect(
    "proves a lost success before accepting an unauthorized retry",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi.fn(() =>
          Promise.resolve(
            Result.succeed(accountDeletionCancellationOutcome.complete)
          )
        );
        const reconcile = vi
          .fn<ReconcileAccountDeletionRequest>()
          .mockReturnValueOnce(
            Effect.succeed(accountDeletionAttemptStatus.pending)
          )
          .mockReturnValueOnce(
            Effect.succeed(accountDeletionAttemptStatus.committed)
          );
        expect(
          yield* runDeletion(
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
        ).toBeUndefined();
        expect(reconcile).toHaveBeenCalledTimes(2);
        expect(cancelPreparation).not.toHaveBeenCalled();
      })
  );
  it.effect("keeps a deletion retry uncertain when proof is unavailable", () =>
    Effect.gen(function* () {
      const request = vi.fn();
      const failure = yield* runDeletion(
        createDeletionOperations({
          reconcile: () =>
            Effect.fail(
              new UserCleanupError({
                code: "USER_CLEANUP_FAILED",
                message: "proof unavailable",
              })
            ),
          request,
          attempt: {
            attemptId: ATTEMPT_ID,
            phase: accountDeletionRequestPhase.deletion,
            userId: USER_ID,
          },
        })
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "AccountDeletionRequestUncertain",
        attemptId: ATTEMPT_ID,
        phase: accountDeletionRequestPhase.deletion,
      });
      expect(request).not.toHaveBeenCalled();
    })
  );
  it.effect(
    "cancels before retrying when the auth safety check is not ready",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi.fn(() =>
          Promise.resolve(
            Result.succeed(accountDeletionCancellationOutcome.complete)
          )
        );
        const clearAttempt = vi.fn();
        const failure = yield* deletionFailure({
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
      })
  );
  it.effect("rotates an attempt canceled by background recovery", () =>
    Effect.gen(function* () {
      const cancelPreparation = vi.fn(() =>
        Promise.resolve(
          Result.succeed(accountDeletionCancellationOutcome.complete)
        )
      );
      const clearAttempt = vi.fn();
      const failure = yield* deletionFailure({
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
    })
  );
  it.effect("returns a typed stale-session failure", () =>
    Effect.gen(function* () {
      const failure = yield* deletionFailure({
        request: requestFailure("SESSION_EXPIRED"),
      });
      expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
    })
  );
  it.effect(
    "drains cancellation before resetting a stale-session attempt",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi
          .fn<CancelAccountDeletionRequest>()
          .mockResolvedValueOnce(
            Result.succeed(accountDeletionCancellationOutcome.continue)
          )
          .mockResolvedValueOnce(
            Result.succeed(accountDeletionCancellationOutcome.complete)
          );
        const failure = yield* deletionFailure({
          cancelPreparation,
          request: requestFailure("SESSION_EXPIRED"),
        });
        expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
        expect(cancelPreparation).toHaveBeenCalledTimes(2);
        expect(cancelPreparation).toHaveBeenNthCalledWith(1, ATTEMPT_ID);
        expect(cancelPreparation).toHaveBeenNthCalledWith(2, ATTEMPT_ID);
      })
  );
  it.effect("leaves other delete errors to durable server recovery", () =>
    Effect.gen(function* () {
      const cancelPreparation = vi.fn(() =>
        Promise.resolve(
          Result.succeed(accountDeletionCancellationOutcome.complete)
        )
      );
      const failure = yield* deletionFailure({
        cancelPreparation,
        request: requestFailure("DELETE_FAILED", 500),
      });
      expect(failure).toBeInstanceOf(AccountDeletionRequestUncertain);
      expect(failure).toMatchObject({
        attemptId: ATTEMPT_ID,
        phase: accountDeletionRequestPhase.deletion,
      });
      expect(cancelPreparation).not.toHaveBeenCalled();
    })
  );
  it.effect(
    "returns a typed failure when an owned school needs a successor",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi.fn(() =>
          Promise.resolve(
            Result.succeed(accountDeletionCancellationOutcome.complete)
          )
        );
        const clearAttempt = vi.fn();
        const failure = yield* deletionFailure({
          cancelPreparation,
          clearAttempt: Effect.sync(clearAttempt),
          request: requestFailure("ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER"),
        });
        expect(failure).toBeInstanceOf(AccountDeletionSchoolMemberRequired);
        expect(cancelPreparation).toHaveBeenCalledExactlyOnceWith(ATTEMPT_ID);
        expect(clearAttempt).toHaveBeenCalledOnce();
      })
  );
  it.effect(
    "preserves the attempt when immediate cancellation also fails",
    () =>
      Effect.gen(function* () {
        const failure = yield* deletionFailure({
          cancelPreparation: () =>
            Promise.reject(new Error("cancellation unavailable")),
          request: requestFailure("SESSION_EXPIRED"),
        });
        expect(failure).toMatchObject({
          _tag: "AccountDeletionRequestUncertain",
          attemptId: ATTEMPT_ID,
          phase: accountDeletionRequestPhase.deletion,
        });
      })
  );
  it.effect(
    "leaves uncertain transport failures to durable server recovery",
    () =>
      Effect.gen(function* () {
        const cancelPreparation = vi.fn(() =>
          Promise.reject(new Error("cancellation unavailable"))
        );
        const failure = yield* runDeletion(
          createDeletionOperations({
            cancelPreparation,
            request: () => Promise.reject(new Error("network unavailable")),
          })
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "AccountDeletionRequestUncertain",
          attemptId: expect.any(String),
          phase: accountDeletionRequestPhase.deletion,
        });
        expect(cancelPreparation).not.toHaveBeenCalled();
      })
  );
});

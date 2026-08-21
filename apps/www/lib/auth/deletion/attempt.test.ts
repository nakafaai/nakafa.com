import { accountDeletionRequestPhase } from "@repo/backend/convex/auth/deletion/spec";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import {
  AccountDeletionAttemptStorageFailed,
  clearAccountDeletionAttempt,
  loadOrCreateAccountDeletionAttempt,
  saveAccountDeletionAttempt,
} from "@/lib/auth/deletion/attempt";

const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const USER_ID = "user-1";

describe("account deletion attempt", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it.live("creates and reloads one tab-owned browser capability", () =>
    Effect.gen(function* () {
      const created = yield* loadOrCreateAccountDeletionAttempt(USER_ID);
      const reloaded = yield* loadOrCreateAccountDeletionAttempt(USER_ID);

      expect(created).toMatchObject({
        attemptId: expect.any(String),
        phase: accountDeletionRequestPhase.preparation,
        userId: USER_ID,
      });
      expect(reloaded).toEqual(created);
    })
  );

  it.live("persists the irreversible phase before auth deletion", () =>
    Effect.gen(function* () {
      const deletionAttempt = {
        attemptId: ATTEMPT_ID,
        phase: accountDeletionRequestPhase.deletion,
        userId: USER_ID,
      } as const;

      yield* saveAccountDeletionAttempt(deletionAttempt);

      expect(yield* loadOrCreateAccountDeletionAttempt(USER_ID)).toEqual(
        deletionAttempt
      );
    })
  );

  it.live(
    "rotates a persisted capability when the signed-in account changes",
    () =>
      Effect.gen(function* () {
        const first = yield* loadOrCreateAccountDeletionAttempt(USER_ID);
        const second = yield* loadOrCreateAccountDeletionAttempt("user-2");

        expect(second).toMatchObject({
          phase: accountDeletionRequestPhase.preparation,
          userId: "user-2",
        });
        expect(second.attemptId).not.toBe(first.attemptId);
      })
  );

  it.live("rotates a capability after its cancellation is proven", () =>
    Effect.gen(function* () {
      const canceled = yield* loadOrCreateAccountDeletionAttempt(USER_ID);

      yield* clearAccountDeletionAttempt();

      const next = yield* loadOrCreateAccountDeletionAttempt(USER_ID);

      expect(next.attemptId).not.toBe(canceled.attemptId);
    })
  );

  it.live("fails closed when persisted state is malformed", () =>
    Effect.gen(function* () {
      window.sessionStorage.setItem(
        "nakafa-account-deletion-attempt",
        '{"attemptId":1}'
      );

      const failure = yield* loadOrCreateAccountDeletionAttempt(USER_ID).pipe(
        Effect.flip
      );

      expect(failure).toBeInstanceOf(AccountDeletionAttemptStorageFailed);
    })
  );

  it.live("fails closed when session storage is unavailable", () =>
    Effect.gen(function* () {
      const unavailableStorage = {
        getItem: () => {
          throw new Error("storage unavailable");
        },
        removeItem: () => {
          throw new Error("storage unavailable");
        },
        setItem: () => {
          throw new Error("storage unavailable");
        },
      };

      const failure = yield* loadOrCreateAccountDeletionAttempt(
        USER_ID,
        unavailableStorage
      ).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(AccountDeletionAttemptStorageFailed);
    })
  );
});

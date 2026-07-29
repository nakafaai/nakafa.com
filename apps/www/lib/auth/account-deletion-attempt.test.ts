import { accountDeletionRequestPhase } from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AccountDeletionAttemptStorageFailed,
  clearAccountDeletionAttempt,
  loadOrCreateAccountDeletionAttempt,
  saveAccountDeletionAttempt,
} from "@/lib/auth/account-deletion-attempt";

const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const USER_ID = "user-1";

describe("account deletion attempt", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("creates and reloads one tab-owned browser capability", async () => {
    const created = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(USER_ID)
    );
    const reloaded = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(USER_ID)
    );

    expect(created).toMatchObject({
      attemptId: expect.any(String),
      phase: accountDeletionRequestPhase.preparation,
      userId: USER_ID,
    });
    expect(reloaded).toEqual(created);
  });

  it("persists the irreversible phase before auth deletion", async () => {
    const deletionAttempt = {
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.deletion,
      userId: USER_ID,
    } as const;

    await Effect.runPromise(saveAccountDeletionAttempt(deletionAttempt));

    await expect(
      Effect.runPromise(loadOrCreateAccountDeletionAttempt(USER_ID))
    ).resolves.toEqual(deletionAttempt);
  });

  it("rotates a persisted capability when the signed-in account changes", async () => {
    const first = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(USER_ID)
    );
    const second = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt("user-2")
    );

    expect(second).toMatchObject({
      phase: accountDeletionRequestPhase.preparation,
      userId: "user-2",
    });
    expect(second.attemptId).not.toBe(first.attemptId);
  });

  it("rotates a capability after its cancellation is proven", async () => {
    const canceled = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(USER_ID)
    );

    await Effect.runPromise(clearAccountDeletionAttempt());

    const next = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(USER_ID)
    );

    expect(next.attemptId).not.toBe(canceled.attemptId);
  });

  it("fails closed when persisted state is malformed", async () => {
    window.sessionStorage.setItem(
      "nakafa-account-deletion-attempt",
      '{"attemptId":1}'
    );

    const failure = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(USER_ID).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionAttemptStorageFailed);
  });

  it("fails closed when session storage is unavailable", async () => {
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

    const failure = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(USER_ID, unavailableStorage).pipe(
        Effect.flip
      )
    );

    expect(failure).toBeInstanceOf(AccountDeletionAttemptStorageFailed);
  });
});

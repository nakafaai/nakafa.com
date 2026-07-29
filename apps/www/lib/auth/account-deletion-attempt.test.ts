import { accountDeletionRequestPhase } from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AccountDeletionAttemptStorageFailed,
  loadOrCreateAccountDeletionAttempt,
  saveAccountDeletionAttempt,
} from "@/lib/auth/account-deletion-attempt";

const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("account deletion attempt", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("creates and reloads one tab-owned browser capability", async () => {
    const created = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt()
    );
    const reloaded = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt()
    );

    expect(created).toMatchObject({
      attemptId: expect.any(String),
      phase: accountDeletionRequestPhase.preparation,
    });
    expect(reloaded).toEqual(created);
  });

  it("persists the irreversible phase before auth deletion", async () => {
    const deletionAttempt = {
      attemptId: ATTEMPT_ID,
      phase: accountDeletionRequestPhase.deletion,
    } as const;

    await Effect.runPromise(saveAccountDeletionAttempt(deletionAttempt));

    await expect(
      Effect.runPromise(loadOrCreateAccountDeletionAttempt())
    ).resolves.toEqual(deletionAttempt);
  });

  it("fails closed when persisted state is malformed", async () => {
    window.sessionStorage.setItem(
      "nakafa-account-deletion-attempt",
      '{"attemptId":1}'
    );

    const failure = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt().pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionAttemptStorageFailed);
  });

  it("fails closed when session storage is unavailable", async () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };

    const failure = await Effect.runPromise(
      loadOrCreateAccountDeletionAttempt(unavailableStorage).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionAttemptStorageFailed);
  });
});

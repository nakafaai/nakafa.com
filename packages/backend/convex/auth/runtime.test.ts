import {
  ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
  ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
  ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
} from "@repo/backend/convex/auth/deletion/constants";
import { accountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import { verifyAccountDeletionPreparation } from "@repo/backend/convex/auth/runtime";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

describe("auth/runtime", () => {
  it("accepts one ready preparation step", async () => {
    const prepare = vi.fn(async () => accountDeletionPreparationOutcome.ready);

    await expect(
      Effect.runPromise(verifyAccountDeletionPreparation(prepare))
    ).resolves.toBeUndefined();
    expect(prepare).toHaveBeenCalledOnce();
  });

  it.each([
    {
      code: ACCOUNT_DELETION_PREPARATION_INCOMPLETE_CODE,
      outcome: accountDeletionPreparationOutcome.continue,
      status: "BAD_REQUEST",
    },
    {
      code: ACCOUNT_DELETION_REQUIRES_SCHOOL_MEMBER_CODE,
      outcome: accountDeletionPreparationOutcome.schoolSuccessorRequired,
      status: "BAD_REQUEST",
    },
    {
      code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
      outcome: accountDeletionPreparationOutcome.temporarilyUnavailable,
      status: "INTERNAL_SERVER_ERROR",
    },
  ])("maps $outcome without draining another step", async (testCase) => {
    const prepare = vi.fn(async () => testCase.outcome);
    const failure = await Effect.runPromise(
      verifyAccountDeletionPreparation(prepare).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      body: {
        code: testCase.code,
      },
      name: "APIError",
      status: testCase.status,
    });
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("maps adapter failures without retrying inside the auth request", async () => {
    const prepare = vi.fn(() =>
      Promise.reject(new Error("preparation unavailable"))
    );
    const failure = await Effect.runPromise(
      verifyAccountDeletionPreparation(prepare).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      body: {
        code: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_CODE,
      },
      name: "APIError",
      status: "INTERNAL_SERVER_ERROR",
    });
    expect(prepare).toHaveBeenCalledOnce();
  });
});

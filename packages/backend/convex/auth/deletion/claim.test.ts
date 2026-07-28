import { claimAccountDeletion } from "@repo/backend/convex/auth/deletion/claim";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { prepareAccountDeletion } from "@repo/backend/convex/auth/deletion/prepare";
import { accountDeletionPreparationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("auth/deletion/claim", () => {
  it("claims the irreversible phase only from the auth delete hook", async () => {
    vi.setSystemTime(NOW);
    const t = convexTest(schema, convexModules);

    await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "claimed-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "claimed-owner@example.com",
        name: "Claimed Owner",
        plan: "free",
      })
    );

    const prepared = await t.mutation((ctx) =>
      runConvexProgram(prepareAccountDeletion(ctx, "claimed-owner", ATTEMPT_ID))
    );
    const cancelablePreparation = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").unique()
    );

    vi.setSystemTime(NOW + 1000);
    const claimed = await t.mutation((ctx) =>
      runConvexProgram(claimAccountDeletion(ctx, "claimed-owner", ATTEMPT_ID))
    );
    const committedPreparation = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").unique()
    );

    expect(prepared).toBe(accountDeletionPreparationOutcome.ready);
    expect(cancelablePreparation).not.toHaveProperty("deletionStartedAt");
    expect(claimed).toBe(accountDeletionPreparationOutcome.ready);
    expect(committedPreparation).toMatchObject({
      attemptId: ATTEMPT_ID,
      deletionStartedAt: NOW + 1000,
      recoveryAt: NOW + 1000 + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
      recoveryGeneration: 3,
    });
  });
});

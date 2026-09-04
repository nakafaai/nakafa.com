import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { observeLegacyWelcomeJobs } from "@repo/backend/convex/emails/welcome/observer";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const legacyWelcomeRuntimeReference = makeFunctionReference<
  "action",
  { userId: string },
  null
>("emails/delivery.js:sendWelcomeEmail");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("emails/welcome/observer", () => {
  it("paginates exact legacy job counts without returning job data", async () => {
    const test = convexTest(schema, convexModules);
    await test.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "legacy-job-observer",
        credits: 0,
        creditsResetAt: 0,
        email: "synthetic-observer@example.com",
        name: "Synthetic Observer",
        plan: "free",
      });
      const canceledJobId = await ctx.scheduler.runAfter(
        60 * 60 * 1000,
        legacyWelcomeRuntimeReference,
        { userId }
      );
      for (let index = 0; index < 32; index += 1) {
        await ctx.scheduler.runAfter(
          60 * 60 * 1000,
          legacyWelcomeRuntimeReference,
          { userId }
        );
      }
      await ctx.scheduler.cancel(canceledJobId);
      await ctx.scheduler.runAfter(
        60 * 60 * 1000,
        internal.emails.retention.cleanupRetainedEmailData,
        {}
      );
    });

    const first = await test.query(
      internal.emails.welcome.observer.observeLegacyWelcomeJobs,
      { cursor: null }
    );
    const second = await test.query(
      internal.emails.welcome.observer.observeLegacyWelcomeJobs,
      { cursor: first.continueCursor }
    );

    expect(first.isDone).toBe(false);
    expect(second.isDone).toBe(true);
    expect({
      canceled: first.canceled + second.canceled,
      failed: first.failed + second.failed,
      inProgress: first.inProgress + second.inProgress,
      pending: first.pending + second.pending,
      success: first.success + second.success,
    }).toEqual({
      canceled: 1,
      failed: 0,
      inProgress: 0,
      pending: 32,
      success: 0,
    });
    expect(Object.keys(first).sort()).toEqual([
      "canceled",
      "continueCursor",
      "failed",
      "inProgress",
      "isDone",
      "pending",
      "success",
    ]);
    expect(JSON.stringify([first, second])).not.toContain("synthetic-observer");
    expect(JSON.stringify([first, second])).not.toContain("Synthetic Observer");
    expect(observeLegacyWelcomeJobs.isInternal).toBe(true);
  });
});

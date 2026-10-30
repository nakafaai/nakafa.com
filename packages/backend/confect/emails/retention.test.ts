import resendTest from "@convex-dev/resend/test";
import { describe, expect, it } from "@effect/vitest";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";

describe("emails/retention", () => {
  it("schedules component retention and app-handle reconciliation", async () => {
    // The retention schedules the Resend component's own cleanups, so the
    // component is registered, as convex-test requires of a called component.
    const test = convexTest(schema, convexModules);
    resendTest.register(test);
    await test.mutation(
      internal.emails.retention.cleanupRetainedEmailData,
      {}
    );
    const scheduledJobs = await test.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [{}],
        name: expect.stringContaining("cleanupOldEmails"),
      }),
      expect.objectContaining({
        args: [{}],
        name: expect.stringContaining("cleanupAbandonedEmails"),
      }),
      expect.objectContaining({
        args: [
          {
            cursor: null,
            phase: "scheduled",
          },
        ],
        name: expect.stringContaining("reconcileWelcomeIntentLifecycle"),
      }),
    ]);
  });
});

import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("emails/mutations", () => {
  it("schedules both component-owned retention sweeps", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(internal.emails.mutations.cleanupRetainedEmailData, {});

    const scheduledJobs = await t.query((ctx) =>
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
    ]);
  });
});

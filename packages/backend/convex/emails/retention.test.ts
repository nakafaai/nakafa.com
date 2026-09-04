import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("emails/retention", () => {
  it.effect("schedules component retention and app-handle reconciliation", () =>
    Effect.gen(function* () {
      const test = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        test.mutation(internal.emails.retention.cleanupRetainedEmailData, {})
      );

      const scheduledJobs = yield* Effect.promise(() =>
        test.query((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.system.query("_scheduled_functions").collect()
            )
          )
        )
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
          args: [{ cursor: null, phase: "scheduled" }],
          name: expect.stringContaining("reconcileWelcomeIntentLifecycle"),
        }),
      ]);
    })
  );
});

import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationCtx,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect } from "effect";

describe("emails/retention", () => {
  it.effect("schedules component retention and app-handle reconciliation", () =>
    Effect.gen(function* () {
      const test = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* test.run(
        Effect.gen(function* () {
          const testCtx = yield* MutationCtx;
          yield* (yield* MutationRunner).runMutation(
            refs.internal.emails.retention.cleanupRetainedEmailData,
            {}
          );
          const scheduledJobs = yield* Effect.promise(() =>
            testCtx.db.system.query("_scheduled_functions").collect()
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
        })
      );
    })
  );
});

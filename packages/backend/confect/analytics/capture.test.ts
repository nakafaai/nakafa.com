import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { registerPostHog } from "@repo/backend/test/posthog";
import { JsonTextSchema } from "@repo/utilities/json";
import { convexTest } from "convex-test";
import { Effect, MutableList, Schema } from "effect";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
const contentViewProperties = {
  alignment_id: "alignment:id:articles:example",
  concept_id: "concept:id:articles:example",
  content_id: "asset:id:articles:example",
  context_key: "canonical",
  content_type: "article",
  is_new_view: true,
  learning_object_id: "lo:id:articles:example",
  lens_id: "lens:id:articles:example",
  locale: "id",
  route: "articles/example",
} as const;

/** A content view event, as the view trigger captures it. */
const contentViewed = {
  event: { name: "content viewed", properties: contentViewProperties },
  timestamp: NOW,
} as const;

/** A test deployment whose PostHog capture action records each call, or fails with `failure`. */
function deploymentCapturing(failure?: Error) {
  const t = convexTest(schema, convexModules);
  const captured = MutableList.make<Record<string, unknown>>();
  registerPostHog(t, (args) => {
    if (failure !== undefined) {
      throw failure;
    }
    MutableList.append(captured, args);
  });
  return { captured, t };
}

describe("analytics/capture", () => {
  it.effect(
    "queues an anonymous event whose properties turn PostHog's person profile off",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const scheduledJobs = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await Effect.runPromiseWith(runtimeServices)(
              captureProductEvent(contentViewed).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            );
            const jobs = await ctx.db.system
              .query("_scheduled_functions")
              .collect();
            for (const job of jobs) {
              await ctx.scheduler.cancel(job._id);
            }
            return jobs;
          })
        );
        const properties = yield* Schema.encodeEffect(JsonTextSchema)({
          ...contentViewProperties,
          $process_person_profile: false,
        }).pipe(Effect.orDie);
        expect(scheduledJobs).toEqual([
          expect.objectContaining({
            args: [{ event: "content viewed", properties, timestamp: NOW }],
            name: expect.stringContaining("deliverProductEvent"),
          }),
        ]);
      })
  );

  it.effect("contains optional analytics scheduling failures", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const scheduledJobs = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runAfter = vi
            .spyOn(ctx.scheduler, "runAfter")
            .mockRejectedValueOnce(new Error("scheduler unavailable"));
          await Effect.runPromiseWith(runtimeServices)(
            captureProductEvent(contentViewed).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          );
          expect(runAfter).toHaveBeenCalledOnce();
          return await ctx.db.system.query("_scheduled_functions").collect();
        })
      );
      expect(scheduledJobs).toEqual([]);
    })
  );
});

describe("analytics/capture delivery", () => {
  it("sends each event under a fresh distinct id of its own, without location", async () => {
    const { captured: deliveries, t } = deploymentCapturing();
    const delivery = {
      event: "content viewed",
      properties: '{"$process_person_profile":false}',
      timestamp: NOW,
    };

    await t.action(internal.analytics.capture.deliverProductEvent, delivery);
    await t.action(internal.analytics.capture.deliverProductEvent, {
      event: "content viewed",
    });

    const captured = MutableList.toArray(deliveries);
    expect(captured).toEqual([
      { ...delivery, disableGeoip: true, distinctId: expect.any(String) },
      {
        disableGeoip: true,
        distinctId: expect.any(String),
        event: "content viewed",
      },
    ]);
    expect(captured[0]?.distinctId).not.toBe(captured[1]?.distinctId);
  });

  it("reports a PostHog failure as a capture error", async () => {
    const { t } = deploymentCapturing(new Error("posthog unavailable"));

    await expect(
      t.action(internal.analytics.capture.deliverProductEvent, {
        event: "content viewed",
      })
    ).rejects.toMatchObject({
      data: {
        code: "PRODUCT_ANALYTICS_CAPTURE_FAILED",
        message: expect.stringContaining("posthog unavailable"),
      },
    });
  });
});

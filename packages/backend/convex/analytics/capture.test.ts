import { describe, expect, it } from "@effect/vitest";
import {
  captureProductEvent,
  deliverProductAnalyticsProgram,
} from "@repo/backend/convex/analytics/capture";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { seedAnalyticsConsent } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { vi } from "vitest";

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

describe("analytics/capture", () => {
  it.effect(
    "schedules current-consent product delivery with validated payload",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const scheduledJobs = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const userId = await ctx.db.insert("users", {
              authId: "analytics-user-auth",
              credits: 10,
              creditsResetAt: NOW,
              email: "analytics@example.com",
              name: "Analytics User",
              plan: "free",
            });
            await seedAnalyticsConsent(ctx, { decidedAt: NOW, userId });

            await runConvexProgram(
              captureProductEvent(ctx, {
                distinctId: userId,
                event: {
                  name: "content viewed",
                  properties: contentViewProperties,
                },
                timestamp: new Date(NOW),
              })
            );

            return await ctx.db.system.query("_scheduled_functions").collect();
          })
        );

        expect(scheduledJobs).toEqual([
          expect.objectContaining({
            args: [
              expect.objectContaining({
                event: "content viewed",
                properties: JSON.stringify(contentViewProperties),
                timestamp: NOW,
              }),
            ],
            name: expect.stringContaining("deliverProductEvent"),
          }),
        ]);
      })
  );

  it.effect("drops a queued event when deletion starts before delivery", () =>
    Effect.gen(function* () {
      const capture = vi.fn(() => Promise.resolve(undefined));
      const requestErasure = vi.fn(() => Effect.void);

      yield* deliverProductAnalyticsProgram({
        capture,
        isUserEligible: vi.fn(() => Promise.resolve(false)),
        requestErasure,
      });

      expect(capture).not.toHaveBeenCalled();
      expect(requestErasure).not.toHaveBeenCalled();
    })
  );

  it.effect("keeps delivered analytics when the user remains active", () =>
    Effect.gen(function* () {
      const capture = vi.fn(() => Promise.resolve(undefined));
      const requestErasure = vi.fn(() => Effect.void);

      yield* deliverProductAnalyticsProgram({
        capture,
        isUserEligible: vi.fn(() => Promise.resolve(true)),
        requestErasure,
      });

      expect(capture).toHaveBeenCalledOnce();
      expect(requestErasure).not.toHaveBeenCalled();
    })
  );

  it.effect("durably erases analytics when withdrawal overlaps the send", () =>
    Effect.gen(function* () {
      const capture = vi.fn(() => Promise.resolve(undefined));
      const requestErasure = vi.fn(() => Effect.void);
      const isUserActive = vi
        .fn<() => Promise<boolean>>()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      yield* deliverProductAnalyticsProgram({
        capture,
        isUserEligible: isUserActive,
        requestErasure,
      });

      expect(capture).toHaveBeenCalledOnce();
      expect(requestErasure).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "requests erasure after a failed send that overlaps withdrawal",
    () =>
      Effect.gen(function* () {
        const requestErasure = vi.fn(() => Effect.void);
        const isUserActive = vi
          .fn<() => Promise<boolean>>()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);

        const failure = yield* deliverProductAnalyticsProgram({
          capture: vi.fn(() => Promise.reject(new Error("capture uncertain"))),
          isUserEligible: isUserActive,
          requestErasure,
        }).pipe(Effect.flip);

        expect(requestErasure).toHaveBeenCalledOnce();
        expect(failure).toMatchObject({
          _tag: "ProductAnalyticsCaptureError",
          message: "capture uncertain",
        });
      })
  );

  it.effect(
    "requests erasure after a send when final eligibility is unknown",
    () =>
      Effect.gen(function* () {
        const requestErasure = vi.fn(() => Effect.void);
        const isUserActive = vi
          .fn<() => Promise<boolean>>()
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error("eligibility unavailable"));

        const failure = yield* deliverProductAnalyticsProgram({
          capture: vi.fn(() => Promise.resolve(undefined)),
          isUserEligible: isUserActive,
          requestErasure,
        }).pipe(Effect.flip);

        expect(requestErasure).toHaveBeenCalledOnce();
        expect(failure).toMatchObject({
          _tag: "ProductAnalyticsCaptureError",
          message: "eligibility unavailable",
        });
      })
  );
});

import { RegisteredConvexFunction } from "@confect/server";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
describe("triggers/contents/views", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: NOW,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it.each(["articles", "material"] as const)(
    "captures signed-in %s views after the engaged write",
    async (section) => {
      const t = createConvexTestWithBetterAuth();
      const article = testArticleProjection(0);
      const material = makeMaterialProjection("en", 1);
      const projection = section === "articles" ? article : material;
      if (section === "material") {
        await t.mutation((ctx) =>
          Effect.runPromise(
            activateMaterialCatalog([material]).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        );
      }
      const identity = await t.mutation(async (ctx) => {
        const identity = await seedAuthenticatedUser(ctx, {
          now: NOW,
        });
        await seedAnalyticsConsent(ctx, {
          decidedAt: NOW,
          userId: identity.userId,
        });
        if (section === "articles") {
          await insertRuntimeArticles(ctx, 1, () => article);
        }
        return identity;
      });
      await t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .mutation(api.contents.mutations.views.recordContentView, {
          contentId: projection.graph.assetId,
          deviceId: "device-1",
          locale: "en",
          publicPath: projection.publicPath,
          section,
        });
      const scheduledJobs = await t.query(
        async (ctx) =>
          await ctx.db.system.query("_scheduled_functions").collect()
      );
      expect(scheduledJobs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            args: [
              expect.objectContaining({
                distinctId: identity.userId,
                event: "content viewed",
                properties: encodeJsonText({
                  alignment_id: projection.graph.alignmentId,
                  concept_id: projection.graph.conceptId,
                  content_id: projection.graph.assetId,
                  context_key: "canonical",
                  content_type: section === "articles" ? "article" : "material",
                  is_new_view: true,
                  learning_object_id: projection.graph.learningObjectId,
                  lens_id: projection.graph.lensId,
                  locale: "en",
                  route: projection.publicPath,
                }),
              }),
            ],
          }),
        ])
      );
    }
  );
});

import { describe, expect, it } from "@effect/vitest";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import {
  contentHead,
  resolveContentHead,
  resolvePublicProjection,
  resolvePublicProjectionProof,
} from "@repo/backend/convex/contentRelease/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  TEST_QUESTION_CONTENT_KEY,
  TEST_QUESTION_PROJECTION_JSON,
  TEST_QUESTION_SOURCE,
} from "@repo/backend/test/content/question";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { insertRuntimeVersion } from "@repo/backend/test/runtime/head";
import { convexTest } from "convex-test";

describe("contentRelease/catalog", () => {
  it("preserves unrouted question heads and rejects invalid compact heads", async () => {
    const material = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(material);
    const readCorruptHead = (corruption: "incomplete" | "invalid") =>
      material.query(async (ctx) => {
        const head = await ctx.db
          .query("contentHeads")
          .withIndex("by_contentKey_and_artifactLocale_and_sequence", (index) =>
            index
              .eq("contentKey", requested.contentKey)
              .eq("artifactLocale", requested.artifactLocale)
              .eq("sequence", 1)
          )
          .unique();
        if (!head) {
          return expect.fail("Expected one material content head.");
        }
        return runConvexProgram(
          contentHead(
            corruption === "incomplete"
              ? { ...head, artifactHash: undefined }
              : { ...head, artifactHash: "invalid-hash" },
            requested.publicPath
          )
        );
      });
    await expect(readCorruptHead("incomplete")).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(readCorruptHead("invalid")).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await expect(
      material.query((ctx) =>
        runConvexProgram(
          resolveContentHead(
            ctx,
            requested.contentKey,
            requested.artifactLocale,
            1
          )
        )
      )
    ).resolves.toMatchObject({ publicPath: requested.publicPath });

    const question = convexTest(schema, convexModules);
    await question.mutation((ctx) =>
      insertRuntimeVersion(ctx, "authenticated", TEST_QUESTION_CONTENT_KEY, {
        headSequence: 1,
        projectionJson: TEST_QUESTION_PROJECTION_JSON,
        sourcePath: TEST_QUESTION_SOURCE,
      })
    );
    const head = await question.query((ctx) =>
      runConvexProgram(
        resolveContentHead(ctx, TEST_QUESTION_CONTENT_KEY, "en", 1)
      )
    );
    expect(head).not.toHaveProperty("publicPath");
    expect(head).toMatchObject({
      contentKey: TEST_QUESTION_CONTENT_KEY,
      family: "question",
    });
  });

  it("returns exact absence from every public catalog reader", async () => {
    const target = convexTest(schema, convexModules);
    const missingKey = "material/lesson/test/missing/section";

    await expect(
      target.query((ctx) =>
        runConvexProgram(resolvePublicProjectionProof(ctx, missingKey, "en", 1))
      )
    ).resolves.toBeNull();
    await expect(
      target.query((ctx) =>
        runConvexProgram(resolvePublicProjection(ctx, missingKey, "en", 1))
      )
    ).resolves.toBeNull();
    await expect(
      target.query((ctx) =>
        runConvexProgram(resolveContentHead(ctx, missingKey, "en", 1))
      )
    ).resolves.toBeNull();
  });

  it.each(["missing", "release"] as const)(
    "rejects a canonical route with %s binding evidence",
    async (corruption) => {
      const target = convexTest(schema, convexModules);
      const requested = makeMaterialProjection("en", 1);
      await activateMaterialCatalog(target);
      await target.mutation(async (ctx) => {
        const binding = await ctx.db
          .query("contentBindings")
          .withIndex(
            "by_appLocale_and_publicPath_and_sequence_and_index",
            (index) =>
              index
                .eq("appLocale", requested.appLocale)
                .eq("publicPath", requested.publicPath)
                .eq("sequence", 1)
          )
          .unique();
        if (!binding) {
          return expect.fail("Expected one canonical material binding.");
        }
        if (corruption === "missing") {
          await ctx.db.delete("contentBindings", binding._id);
          return;
        }
        await ctx.db.patch("contentBindings", binding._id, {
          releaseId: "release-mismatch",
        });
      });

      await expect(
        target.query((ctx) =>
          runConvexProgram(
            resolvePublicProjectionProof(
              ctx,
              requested.contentKey,
              requested.artifactLocale,
              1
            )
          )
        )
      ).rejects.toMatchObject({
        data: {
          code:
            corruption === "missing"
              ? "CONTENT_RELEASE_ROUTE"
              : "CONTENT_RELEASE_INTEGRITY",
        },
      });
    }
  );

  it.each(["projection", "family"] as const)(
    "rejects %s corruption while resolving one effective head",
    async (corruption) => {
      const target = convexTest(schema, convexModules);
      const requested = makeMaterialProjection("en", 1);
      await activateMaterialCatalog(target);
      await target.mutation(async (ctx) => {
        const head = await ctx.db
          .query("contentHeads")
          .withIndex("by_contentKey_and_artifactLocale_and_sequence", (index) =>
            index
              .eq("contentKey", requested.contentKey)
              .eq("artifactLocale", requested.artifactLocale)
              .eq("sequence", 1)
          )
          .unique();
        if (!head) {
          return expect.fail("Expected one corruptible material head.");
        }
        if (corruption === "projection") {
          await ctx.db.patch("contentHeads", head._id, {
            projectionJson: undefined,
          });
          return;
        }
        await ctx.db.patch("contentHeads", head._id, { family: "article" });
      });

      await expect(
        target.query((ctx) =>
          runConvexProgram(
            resolveContentHead(
              ctx,
              requested.contentKey,
              requested.artifactLocale,
              1
            )
          )
        )
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    }
  );

  it("rejects a decoded projection whose stored artifact locale drifted", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await target.mutation((ctx) =>
      insertRuntimeVersion(ctx, "public", requested.contentKey, {
        artifactLocale: ArtifactLocaleSchema.make("id"),
        headSequence: 1,
        projectionJson: canonicalizeMaterialProjection(requested),
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(resolveContentHead(ctx, requested.contentKey, "id", 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it.each(["projection", "hash", "provenance"] as const)(
    "rejects %s corruption in an exact public projection proof",
    async (corruption) => {
      const target = convexTest(schema, convexModules);
      const requested = makeMaterialProjection("en", 1);
      await activateMaterialCatalog(target);
      await target.mutation(async (ctx) => {
        const head = await ctx.db
          .query("contentHeads")
          .withIndex("by_contentKey_and_artifactLocale_and_sequence", (index) =>
            index
              .eq("contentKey", requested.contentKey)
              .eq("artifactLocale", requested.artifactLocale)
              .eq("sequence", 1)
          )
          .unique();
        if (!head) {
          return expect.fail("Expected one provable material head.");
        }
        if (corruption === "projection") {
          await ctx.db.patch("contentHeads", head._id, {
            projectionHash: undefined,
          });
          return;
        }
        if (corruption === "hash") {
          await ctx.db.patch("contentHeads", head._id, {
            projectionHash: `sha256:${"f".repeat(64)}`,
          });
          return;
        }
        await ctx.db.patch("contentHeads", head._id, {
          rendererDomain: undefined,
        });
      });

      await expect(
        target.query((ctx) =>
          runConvexProgram(
            resolvePublicProjectionProof(
              ctx,
              requested.contentKey,
              requested.artifactLocale,
              1
            )
          )
        )
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    }
  );

  it("keeps question bodies outside the public route projection contract", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) =>
      insertRuntimeVersion(ctx, "public", TEST_QUESTION_CONTENT_KEY, {
        headSequence: 1,
        projectionJson: TEST_QUESTION_PROJECTION_JSON,
        sourcePath: TEST_QUESTION_SOURCE,
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          resolvePublicProjectionProof(ctx, TEST_QUESTION_CONTENT_KEY, "en", 1)
        )
      )
    ).resolves.toBeNull();
  });
});

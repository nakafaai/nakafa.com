import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  findTryoutBundleByRelease,
  retainTryoutBundle,
  type TryoutBundleSource,
} from "@repo/backend/convex/tryouts/runtime/bundle";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 7, 3, 12, 0, 0);
const source: TryoutBundleSource = {
  manifestHash: TEST_MANIFEST_HASH,
  releaseId: TEST_RELEASE_ID,
  releaseJson: testReleaseJson(),
  rendererJson: testRendererJson(),
  snapshotId: TEST_DIGEST,
};

describe("tryouts/runtime/bundle", () => {
  it("stores one immutable bundle and reuses its exact identity", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const first = await runConvexProgram(
        retainTryoutBundle(ctx, source, NOW)
      );
      const second = await runConvexProgram(
        retainTryoutBundle(ctx, source, NOW + 1)
      );
      const found = await runConvexProgram(
        findTryoutBundleByRelease(ctx, source.releaseId)
      );
      const rows = await ctx.db.query("tryoutBundles").collect();
      return { first, found, rows, second };
    });

    expect(result.first).toEqual(result.second);
    expect(result.found?._id).toEqual(result.first);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      ...source,
      createdAt: NOW,
      index: 0,
    });
  });

  it("rejects changed bytes for an existing release identity", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        await runConvexProgram(retainTryoutBundle(ctx, source, NOW));
        await runConvexProgram(
          retainTryoutBundle(
            ctx,
            { ...source, rendererJson: testRendererJson(TEST_MANIFEST_HASH) },
            NOW + 1
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_BUNDLE_CONFLICT" },
    });
  });

  it("rejects a changed snapshot for an existing release identity", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        await runConvexProgram(retainTryoutBundle(ctx, source, NOW));
        await runConvexProgram(
          retainTryoutBundle(
            ctx,
            { ...source, snapshotId: TEST_MANIFEST_HASH },
            NOW + 1
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_BUNDLE_CONFLICT" },
    });
  });

  it("maps an oversized retained bundle to its owned write failure", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          retainTryoutBundle(
            ctx,
            { ...source, rendererJson: "x".repeat(CONTENT_DOCUMENT_LIMIT) },
            NOW
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_BUNDLE_WRITE_FAILED" },
    });
  });
});

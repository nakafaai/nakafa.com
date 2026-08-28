import { describe, expect, it } from "@effect/vitest";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { LEGACY_TRYOUT_RUNTIME } from "@nakafa/aksara-contracts/release/current/legacy";
import {
  inheritContentSnapshot,
  inheritContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { retainActivatedTryoutBundle } from "@repo/backend/convex/contentRelease/tryout/bundle";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import { convexTest } from "convex-test";
import { Schema } from "effect";

const ACTIVATED_AT = Date.UTC(2026, 7, 6, 4, 0, 0);
const snapshots = {
  ...inheritContentSnapshots(null),
  tryout: inheritContentSnapshot(LEGACY_TRYOUT_RUNTIME.snapshotId),
};
const releaseJson = testReleaseJson({
  baseManifestHash: TEST_DIGEST,
  baseReleaseId: "release-legacy-base",
  manifestHash: LEGACY_TRYOUT_RUNTIME.manifestHash,
  releaseId: LEGACY_TRYOUT_RUNTIME.releaseId,
  rendererHash: LEGACY_TRYOUT_RUNTIME.rendererManifestHash,
  snapshots,
});
const signed = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
  JSON.parse(releaseJson)
);
const release = {
  releaseId: LEGACY_TRYOUT_RUNTIME.releaseId,
  releaseJson,
  rendererJson: testRendererJson(LEGACY_TRYOUT_RUNTIME.rendererManifestHash),
};

describe("contentRelease/tryout/bundle", () => {
  it("retains and reuses the active signed try-out bundle", async () => {
    const t = convexTest(schema, convexModules);

    const rows = await t.mutation(async (ctx) => {
      await runConvexProgram(
        retainActivatedTryoutBundle(ctx, release, signed, ACTIVATED_AT)
      );
      await runConvexProgram(
        retainActivatedTryoutBundle(ctx, release, signed, ACTIVATED_AT + 1)
      );
      return ctx.db.query("tryoutBundles").collect();
    });

    expect(rows).toEqual([
      expect.objectContaining({
        createdAt: ACTIVATED_AT,
        index: 0,
        manifestHash: signed.manifestHash,
        releaseId: LEGACY_TRYOUT_RUNTIME.releaseId,
        releaseJson,
        rendererJson: release.rendererJson,
        snapshotId: LEGACY_TRYOUT_RUNTIME.snapshotId,
      }),
    ]);
  });

  it("does not retain a bundle when the active release has no try-out snapshot", async () => {
    const t = convexTest(schema, convexModules);
    const emptyReleaseJson = testReleaseJson();
    const emptySigned = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
      JSON.parse(emptyReleaseJson)
    );

    const rows = await t.mutation(async (ctx) => {
      await runConvexProgram(
        retainActivatedTryoutBundle(
          ctx,
          { ...release, releaseJson: emptyReleaseJson },
          emptySigned,
          ACTIVATED_AT
        )
      );
      return ctx.db.query("tryoutBundles").collect();
    });

    expect(rows).toEqual([]);
  });

  it("maps reused release bytes to a publication conflict", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        await runConvexProgram(
          retainActivatedTryoutBundle(ctx, release, signed, ACTIVATED_AT)
        );
        await runConvexProgram(
          retainActivatedTryoutBundle(
            ctx,
            { ...release, rendererJson: testRendererJson(signed.manifestHash) },
            signed,
            ACTIVATED_AT + 1
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("maps bundle storage failures to publication integrity", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          retainActivatedTryoutBundle(
            ctx,
            { ...release, rendererJson: "x".repeat(CONTENT_DOCUMENT_LIMIT) },
            signed,
            ACTIVATED_AT
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

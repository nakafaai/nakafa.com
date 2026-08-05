import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { retainActivatedTryoutBundle } from "@repo/backend/convex/contentRelease/tryout/bundle";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const ACTIVATED_AT = Date.UTC(2026, 7, 6, 4, 0, 0);
const snapshots = {
  ...inheritContentSnapshots(null),
  tryout: replaceContentSnapshot({
    baseSnapshotId: null,
    resultSnapshotId: TEST_DIGEST,
    rowCount: 1,
    rowDigest: TEST_DIGEST,
  }),
};
const releaseJson = testReleaseJson({ snapshots });
const signed = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
  JSON.parse(releaseJson)
);
const release = {
  releaseId: TEST_RELEASE_ID,
  releaseJson,
  rendererJson: testRendererJson(),
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
        releaseId: TEST_RELEASE_ID,
        releaseJson,
        rendererJson: release.rendererJson,
        snapshotId: TEST_DIGEST,
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

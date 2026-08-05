import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readFeaturedTryout } from "@repo/backend/convex/tryouts/catalog/featured";
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import {
  activateTryoutStartSource,
  makeTryoutStartPlacement,
  TRYOUT_START_CONTENT_HASH,
} from "@repo/backend/test/tryout-source";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/catalog/featured", () => {
  it("returns the first authored signed question without exposing its answer", async () => {
    const t = convexTest(schema, convexModules);
    const source = makeTryoutStartPlacement("id");
    await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"));

    const featured = await t.query((ctx) =>
      runConvexProgram(readFeaturedTryout(ctx, "id"))
    );

    expect(featured).toEqual({
      choices: [
        {
          isCorrect: true,
          label: "A",
          optionKey: "option-1",
          order: 1,
        },
      ],
      question: {
        artifactHash: source.questionArtifactHash,
        contentHash: TRYOUT_START_CONTENT_HASH,
        contentKey: source.questionContentKey,
        delivery: "authenticated",
        locale: "id",
        questionOrder: 1,
        snapshotReleaseId: TEST_RELEASE_ID,
        snapshotId: expect.any(String),
        sourcePath: source.questionSourcePath,
        sourceRevision: source.sourceRevision,
      },
    });
    expect(featured.question).not.toHaveProperty("answerArtifactHash");
  });

  it("requires one active signed hierarchy", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readFeaturedTryout(ctx, "id")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });
});

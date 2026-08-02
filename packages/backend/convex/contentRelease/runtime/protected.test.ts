import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertProtectedRuntime } from "@repo/backend/test/protected-runtime";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const readProtected = internal.contentRelease.runtime.protected.readProtected;

describe("contentRelease/runtime/protected", () => {
  it("returns exact signed question and answer bodies", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertProtectedRuntime);

    const [question, answer] = await Promise.all([
      t.query(readProtected, fixture.question),
      t.query(readProtected, fixture.answer),
    ]);

    expect(question).toMatchObject({
      delivery: "authenticated",
      snapshotId: fixture.snapshotId,
      sourcePath: `${fixture.placement.questionSourcePath}/question.en.mdx`,
    });
    expect(answer).toMatchObject({
      delivery: "entitled",
      snapshotId: fixture.snapshotId,
      sourcePath: `${fixture.placement.questionSourcePath}/answer.en.mdx`,
    });
  });

  it("returns absence for selectors outside the retained snapshot", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertProtectedRuntime);

    await expect(
      t.query(readProtected, {
        ...fixture.question,
        artifactHash: `sha256:${"f".repeat(64)}`,
      })
    ).resolves.toBeNull();
    await expect(
      t.query(readProtected, {
        ...fixture.question,
        snapshotId: `sha256:${"e".repeat(64)}`,
      })
    ).resolves.toBeNull();
  });

  it("fails closed when retained placement or artifact storage is damaged", async () => {
    const placementDamage = convexTest(schema, convexModules);
    const placementFixture = await placementDamage.mutation(
      insertProtectedRuntime
    );
    await placementDamage.mutation(async (ctx) => {
      const placement = await ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_questionArtifactHash", (index) =>
          index
            .eq("snapshotId", placementFixture.snapshotId)
            .eq("questionArtifactHash", placementFixture.question.artifactHash)
        )
        .unique();
      if (!placement) {
        throw new Error("Expected protected placement.");
      }
      await ctx.db.patch("tryoutPlacements", placement._id, { rowJson: "{}" });
    });
    await expect(
      placementDamage.query(readProtected, placementFixture.question)
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const artifactDamage = convexTest(schema, convexModules);
    const artifactFixture = await artifactDamage.mutation(
      insertProtectedRuntime
    );
    await artifactDamage.mutation(async (ctx) => {
      const artifact = await ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", artifactFixture.answer.artifactHash)
        )
        .unique();
      if (!artifact) {
        throw new Error("Expected protected artifact.");
      }
      await ctx.db.delete("contentArtifacts", artifact._id);
    });
    await expect(
      artifactDamage.query(readProtected, artifactFixture.answer)
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });
});

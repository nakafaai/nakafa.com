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

  it("keeps the attempt renderer after active release compaction", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertProtectedRuntime);
    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      const state = await ctx.db.query("contentState").unique();
      if (!(release && state)) {
        throw new Error("Expected active runtime state.");
      }
      await ctx.db.delete("contentReleases", release._id);
      await ctx.db.delete("contentState", state._id);
    });

    await expect(
      t.query(readProtected, fixture.question)
    ).resolves.toMatchObject({
      snapshotReleaseId: fixture.question.snapshotReleaseId,
      snapshotId: fixture.snapshotId,
    });
  });

  it("allows one signed artifact to be shared by multiple placements", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertProtectedRuntime);
    await t.mutation(async (ctx) => {
      const stored = await ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_questionArtifactHash", (index) =>
          index
            .eq("snapshotId", fixture.snapshotId)
            .eq("questionArtifactHash", fixture.question.artifactHash)
        )
        .first();
      if (!stored) {
        throw new Error("Expected protected placement.");
      }
      const { _creationTime, _id, ...placement } = stored;
      await ctx.db.insert("tryoutPlacements", placement);
    });

    await expect(
      t.query(readProtected, fixture.question)
    ).resolves.toMatchObject({
      delivery: "authenticated",
      snapshotId: fixture.snapshotId,
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

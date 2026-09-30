import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { compactProgram } from "@repo/backend/confect/contentRelease/compact";
import { ARTIFACT_PAGE_COUNT } from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { insertTestArtifact } from "@repo/backend/test/content/artifact";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/compact/artifacts", () => {
  it("freezes artifact expiry at the durable cycle start", async () => {
    const t = convexTest(schema, convexModules);
    const expiredHash = `sha256:${"1".repeat(64)}`;
    const futureHash = `sha256:${"2".repeat(64)}`;
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentState", {
        articleSlot: "blue",
        compactFloor: 1,
        compactFrom: 0,
        compactPhase: "facts",
        compactStartedAt: 0,
        key: "primary",
        materialSlot: "blue",
        nextSequence: 2,
        searchSlot: "blue",
        updatedAt: 0,
      });
      for (const artifact of [
        {
          artifactHash: expiredHash,
          retainUntil: 0,
        },
        {
          artifactHash: futureHash,
          retainUntil: 1,
        },
      ]) {
        await insertTestArtifact(ctx, {
          artifactHash: artifact.artifactHash,
          artifactJson: "{}",
          retainUntil: artifact.retainUntil,
        });
      }
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          compactProgram().pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      complete: false,
      deleted: 1,
      phase: "snapshots",
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          compactProgram().pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      complete: false,
      floor: 1,
      phase: "releases",
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          compactProgram().pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      complete: true,
      floor: 1,
    });
    const hashes = await t.run(async (ctx) => ({
      artifacts: (await ctx.db.query("contentArtifacts").collect()).map(
        ({ artifactHash }) => artifactHash
      ),
      facts: (await ctx.db.query("contentArtifactFacts").collect()).map(
        ({ artifactHash }) => artifactHash
      ),
    }));
    expect(hashes).toEqual({ artifacts: [futureHash], facts: [futureHash] });
  });
  it("yields artifact compaction at the bounded maintenance page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentState", {
        articleSlot: "blue",
        compactFloor: 1,
        compactFrom: 0,
        compactPhase: "facts",
        compactStartedAt: 1,
        key: "primary",
        materialSlot: "blue",
        nextSequence: 2,
        searchSlot: "blue",
        updatedAt: 0,
      });
      for (let index = 0; index < ARTIFACT_PAGE_COUNT + 1; index += 1) {
        await insertTestArtifact(ctx, {
          artifactHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          artifactJson: "{}",
          retainUntil: 0,
        });
      }
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          compactProgram().pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      complete: false,
      deleted: ARTIFACT_PAGE_COUNT,
      phase: "facts",
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          compactProgram().pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      complete: false,
      deleted: 1,
      phase: "snapshots",
    });
  });
});

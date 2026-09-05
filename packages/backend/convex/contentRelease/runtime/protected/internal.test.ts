import { assert, describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { internal } from "@repo/backend/convex/_generated/api";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertProtectedRuntime } from "@repo/backend/test/runtime/protected";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const readProtected = internal.contentRelease.runtime.protected.internal.read;

/** Builds one protected batch from the shared fixture snapshot identity. */
function batch(
  fixture: Awaited<ReturnType<typeof insertProtectedRuntime>>,
  selectors = [fixture.question, fixture.answer]
) {
  return {
    bundleHash: fixture.request.bundleHash,
    selectors: selectors.map(({ artifactHash, contentKey, delivery }) => ({
      artifactHash,
      contentKey,
      delivery,
    })),
    snapshotId: fixture.snapshotId,
  };
}

describe("contentRelease/runtime/protected/internal", () => {
  it.effect("rejects invalid or reassigned protected selectors", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* Effect.promise(() =>
        t.mutation(insertProtectedRuntime)
      );
      for (const contentKey of [
        "",
        fixture.answer.contentKey,
        fixture.question.contentKey.replace("question-1", "question-2"),
      ]) {
        yield* Effect.promise(() =>
          expect(
            t.query(readProtected, {
              ...batch(fixture),
              selectors: [{ ...fixture.question, contentKey }],
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      }
    })
  );

  it.effect("rejects ambiguous permanent bundle ownership", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* Effect.promise(() =>
        t.mutation(insertProtectedRuntime)
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await ctx.db.get(fixture.runtimeId);
          assert.isNotNull(stored);
          const { _creationTime, _id, ...bundle } = stored;
          await ctx.db.insert("tryoutRuntimeBundles", bundle);
        })
      );
      yield* Effect.promise(() =>
        expect(t.query(readProtected, batch(fixture))).rejects.toThrow(
          "unique() query returned more than one result"
        )
      );
    })
  );

  it.effect("rejects a stored artifact moved into another locale", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* Effect.promise(() =>
        t.mutation(insertProtectedRuntime)
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (index) =>
              index.eq("artifactHash", fixture.question.artifactHash)
            )
            .unique();
          assert.isNotNull(stored);
          const artifact = await runConvexProgram(
            decodeArtifactJson(stored.artifactJson)
          );
          await ctx.db.patch(stored._id, {
            artifactJson: JSON.stringify({
              ...artifact,
              payload: { ...artifact.payload, artifactLocale: "id" },
            }),
          });
        })
      );
      yield* Effect.promise(() =>
        expect(t.query(readProtected, batch(fixture))).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );

  it("returns exact signed question and answer bodies", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertProtectedRuntime);

    const result = await t.query(readProtected, batch(fixture));
    if (!result) {
      throw new Error("Expected one protected runtime batch.");
    }
    const [question, answer] = result.items;

    expect(question).toMatchObject({
      delivery: "authenticated",
      sourcePath: `${fixture.placement.questionSourcePath}/question.en.mdx`,
    });
    expect(answer).toMatchObject({
      delivery: "entitled",
      sourcePath: `${fixture.placement.questionSourcePath}/answer.en.mdx`,
    });
    expect(JSON.parse(result.bundleJson)).toMatchObject({
      bundleHash: fixture.request.bundleHash,
      payload: { snapshot: { snapshotId: fixture.snapshotId } },
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
      t.query(readProtected, batch(fixture, [fixture.question]))
    ).resolves.toMatchObject({
      bundleJson: expect.any(String),
      rendererJson: expect.any(String),
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
      t.query(readProtected, batch(fixture, [fixture.question]))
    ).resolves.toMatchObject({
      items: [{ delivery: "authenticated" }],
    });
  });

  it("returns absence for unknown selectors and rejects bundle mismatch", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(insertProtectedRuntime);

    await expect(
      t.query(readProtected, {
        ...batch(fixture),
        bundleHash: Sha256HashSchema.make(`sha256:${"e".repeat(64)}`),
      })
    ).resolves.toBeNull();
    await expect(
      t.query(
        readProtected,
        batch(fixture, [
          {
            ...fixture.question,
            artifactHash: Sha256HashSchema.make(`sha256:${"f".repeat(64)}`),
          },
        ])
      )
    ).resolves.toBeNull();
    await expect(
      t.query(readProtected, {
        ...batch(fixture, [fixture.question]),
        snapshotId: Sha256HashSchema.make(`sha256:${"e".repeat(64)}`),
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
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
      placementDamage.query(
        readProtected,
        batch(placementFixture, [placementFixture.question])
      )
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
      artifactDamage.query(
        readProtected,
        batch(artifactFixture, [artifactFixture.answer])
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });
});

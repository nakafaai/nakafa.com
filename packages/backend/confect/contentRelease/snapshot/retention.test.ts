import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/spec";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { isSnapshotReferenced } from "@repo/backend/confect/contentRelease/snapshot/retention";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  compactionIdentity,
  insertCompletedRelease,
} from "@repo/backend/test/content/compact";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { encodeJsonText } from "@repo/utilities/json";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

/** Loads one stored release row by its release identity. */
async function storedRelease(ctx: MutationCtx, releaseId: string) {
  const release = await ctx.db
    .query("contentReleases")
    .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
    .unique();
  assert.ok(release, `Expected release ${releaseId}.`);
  return release;
}

/** Runs the snapshot reference proof for one family in its own mutation. */
function referenced(
  t: TestConvex<typeof schema>,
  family: "assessment" | "program",
  snapshotId: string
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      isSnapshotReferenced(family, snapshotId).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
        )
      )
    )
  );
}

describe("contentRelease/snapshot/retention", () => {
  it.effect(
    "protects snapshots selected by publication slots and recent history",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        const candidate = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          candidate.mutation((ctx) =>
            insertTestRelease(ctx, {
              snapshots: data.snapshots,
            })
          )
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                isSnapshotReferenced("program", data.snapshotId).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          ).resolves.toBe(true)
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                isSnapshotReferenced(
                  "program",
                  `sha256:${"9".repeat(64)}`
                ).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          ).resolves.toBe(false)
        );
        yield* Effect.promise(() =>
          candidate.mutation(async (ctx) => {
            const [release, state] = await Promise.all([
              ctx.db.query("contentReleases").unique(),
              ctx.db.query("contentState").unique(),
            ]);
            if (!(release && state)) {
              throw new Error("Expected candidate snapshot release.");
            }
            await ctx.db.patch("contentReleases", release._id, {
              completedAt: 1,
              status: "completed",
            });
            await ctx.db.patch("contentState", state._id, {
              candidateManifestHash: undefined,
              candidateReleaseId: undefined,
              candidateSequence: undefined,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                isSnapshotReferenced("program", data.snapshotId).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          ).resolves.toBe(true)
        );
      })
  );
  it.effect(
    "keeps a snapshot reachable when a retained release stored unknown manifest fields",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        const candidate = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          candidate.mutation(async (ctx) => {
            await insertTestRelease(ctx, {
              snapshots: data.snapshots,
            });
            const release = await ctx.db.query("contentReleases").unique();
            if (!release) {
              throw new Error("Expected candidate snapshot release.");
            }
            const stored = Schema.decodeSync(
              Schema.fromJsonString(SignedContentReleaseSchema)
            )(release.releaseJson);
            await ctx.db.patch("contentReleases", release._id, {
              releaseJson: encodeJsonText({
                ...stored,
                manifest: {
                  ...stored.manifest,
                  rendererContractVersion: "1.0.0",
                },
              }),
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                isSnapshotReferenced("program", data.snapshotId).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          ).resolves.toBe(true)
        );
      })
  );
  it.effect(
    "keeps a snapshot reachable when the retained release declares a direct base",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        const base = compactionIdentity(1);
        const candidate = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          candidate.mutation(async (ctx) => {
            await insertCompletedRelease(ctx, base);
            await insertTestRelease(ctx, {
              originReleaseId: base.releaseId,
              originKind: "git",
              sequence: 2,
              snapshots: data.snapshots,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                isSnapshotReferenced("program", data.snapshotId).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          ).resolves.toBe(true)
        );
      })
  );
  it.effect(
    "keeps a snapshot reachable through a stored direct base transition",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        const base = {
          manifestHash: `sha256:${"b".repeat(64)}`,
          releaseId: "release-retention-base",
          sequence: 1,
        } as const;
        const candidate = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          candidate.mutation(async (ctx) => {
            await insertZeroRelease(ctx, {
              ...base,
              ownership: {
                base: [],
                result: [],
              },
              role: "candidate",
              snapshots: data.snapshots,
              status: "completed",
            });
            await insertTestRelease(ctx, {
              releaseId: "release-retention-child",
              sequence: 2,
              snapshots: inheritContentSnapshots(null),
            });
            const child = await ctx.db
              .query("contentReleases")
              .withIndex("by_releaseId", (query) =>
                query.eq("releaseId", "release-retention-child")
              )
              .unique();
            if (!child) {
              throw new Error("Expected base-release child fixture.");
            }
            await ctx.db.patch("contentReleases", child._id, {
              baseManifestHash: base.manifestHash,
              baseReleaseId: base.releaseId,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                isSnapshotReferenced("program", data.snapshotId).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          ).resolves.toBe(true)
        );
      })
  );
  it.effect(
    "protects an assessment snapshot while an attempt names it, never for a scale alone",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
        yield* world.start();
        expect(
          yield* world.run(isSnapshotReferenced("assessment", world.snapshotId))
        ).toBe(true);
        const scaleSnapshotId = `sha256:${"7".repeat(64)}`;
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.insert("irtScaleVersions", {
              assessmentSnapshotId: scaleSnapshotId,
              model: "2pl",
              publishedAt: TRYOUT_NOW,
              questionCount: 1,
              setIdentity: "indonesia/snbt/2027/set-1",
              status: "provisional",
            })
          )
        );
        expect(
          yield* world.run(isSnapshotReferenced("assessment", scaleSnapshotId))
        ).toBe(false);
      })
  );
  it("does not protect a bootstrap's base snapshot, even when its base release is gone", async () => {
    const t = convexTest(schema, convexModules);
    const replacedSnapshotId = `sha256:${"7".repeat(64)}`;
    const resultSnapshotId = `sha256:${"8".repeat(64)}`;
    await t.mutation(async (ctx) => {
      const bootstrap = compactionIdentity(2);
      await insertCompletedRelease(ctx, bootstrap, compactionIdentity(1));
      const row = await storedRelease(ctx, bootstrap.releaseId);
      await ctx.db.patch("contentReleases", row._id, {
        bootstrap: true,
        snapshotTransitions: {
          ...row.snapshotTransitions,
          assessment: {
            ...row.snapshotTransitions.assessment,
            baseSnapshotId: replacedSnapshotId,
            resultSnapshotId,
          },
        },
      });
      await insertTestState(ctx, { active: bootstrap, nextSequence: 3 });
    });
    await expect(referenced(t, "assessment", replacedSnapshotId)).resolves.toBe(
      false
    );
    await expect(referenced(t, "assessment", resultSnapshotId)).resolves.toBe(
      true
    );
  });
  it("does not protect a snapshot selected only by a completed release below the bootstrap floor", async () => {
    const t = convexTest(schema, convexModules);
    const retiredSnapshotId = `sha256:${"5".repeat(64)}`;
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      await insertCompletedRelease(ctx, retired);
      const retiredRow = await storedRelease(ctx, retired.releaseId);
      await ctx.db.patch("contentReleases", retiredRow._id, {
        snapshotTransitions: {
          ...retiredRow.snapshotTransitions,
          program: {
            ...retiredRow.snapshotTransitions.program,
            resultSnapshotId: retiredSnapshotId,
          },
        },
      });
      await insertCompletedRelease(ctx, bootstrap);
      const bootstrapRow = await storedRelease(ctx, bootstrap.releaseId);
      await ctx.db.patch("contentReleases", bootstrapRow._id, {
        bootstrap: true,
      });
      await insertTestState(ctx, { active: bootstrap, nextSequence: 3 });
    });
    await expect(referenced(t, "program", retiredSnapshotId)).resolves.toBe(
      false
    );
  });
  it("still protects the base snapshot of an ordinary active release", async () => {
    const t = convexTest(schema, convexModules);
    const baseSnapshotId = `sha256:${"6".repeat(64)}`;
    await t.mutation(async (ctx) => {
      const base = compactionIdentity(1);
      const active = compactionIdentity(2);
      await insertCompletedRelease(ctx, base);
      await insertCompletedRelease(ctx, active, base);
      const row = await storedRelease(ctx, active.releaseId);
      await ctx.db.patch("contentReleases", row._id, {
        snapshotTransitions: {
          ...row.snapshotTransitions,
          assessment: {
            ...row.snapshotTransitions.assessment,
            baseSnapshotId,
          },
        },
      });
      await insertTestState(ctx, { active, nextSequence: 3 });
    });
    await expect(referenced(t, "assessment", baseSnapshotId)).resolves.toBe(
      true
    );
  });
});

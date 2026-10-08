import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/spec";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  hasSnapshotArtifactReference,
  isSnapshotReferenced,
} from "@repo/backend/confect/contentRelease/snapshot/retention";
import { tryoutPlacementFacts } from "@repo/backend/confect/contentRelease/tryout/facts";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  compactionIdentity,
  insertCompletedRelease,
} from "@repo/backend/test/content/compact";
import { TEST_ARTIFACT_HASH } from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { insertZeroRelease } from "@repo/backend/test/content/state";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const UnknownJsonSchema = Schema.fromJsonString(Schema.Unknown);

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
              releaseJson: Schema.encodeSync(UnknownJsonSchema)({
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
  it("finds question and answer artifacts retained by try-out placements", async () => {
    const t = convexTest(schema, convexModules);
    const answerHash = `sha256:${"3".repeat(64)}`;
    const placement = makeTryoutPlacementRow().record;
    await t.mutation((ctx) =>
      ctx.db.insert("tryoutPlacements", {
        ...tryoutPlacementFacts(placement),
        answerArtifactHash: answerHash,
        index: 0,
        questionArtifactHash: TEST_ARTIFACT_HASH,
        rowHash: placement.rowHash,
        rowJson: "{}",
        snapshotId: `sha256:${"5".repeat(64)}`,
      })
    );
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          hasSnapshotArtifactReference(TEST_ARTIFACT_HASH).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          hasSnapshotArtifactReference(answerHash).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          hasSnapshotArtifactReference(`sha256:${"6".repeat(64)}`).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(false);
  });
  it("protects try-out snapshots referenced by attempts and IRT scales", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "snapshot-retention",
      });
      const fixture = await activateTryoutStartSource(ctx, "visible", "irt");
      return {
        fixture,
        identity,
      };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });
    await authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      locale: "id",
      setKey: TRYOUT_START_SET,
      trackKey: TRYOUT_START_TRACK,
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          isSnapshotReferenced("tryout", seeded.fixture.snapshotId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(true);
    const scaleSnapshotId = `sha256:${"7".repeat(64)}`;
    await t.mutation((ctx) =>
      ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: TRYOUT_START_NOW,
        questionCount: 1,
        setIdentity: seeded.fixture.setIdentity,
        status: "provisional",
        tryoutSnapshotId: scaleSnapshotId,
      })
    );
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          isSnapshotReferenced("tryout", scaleSnapshotId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(true);
  });
});

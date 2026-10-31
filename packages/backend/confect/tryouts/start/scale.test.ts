import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { client } from "@repo/backend/test/client";
import {
  startArgs,
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Struct } from "effect";

/** Reads every scale with its items and calibration runs. */
const readScales = (world: TryoutWorld) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      items: await ctx.db.query("irtScaleItems").collect(),
      runs: await ctx.db.query("irtCalibrationRuns").collect(),
      scales: await ctx.db.query("irtScaleVersions").collect(),
    }))
  );

/** Starts the fixture set as another learner. */
const startAsAnother = (world: TryoutWorld, suffix: string) =>
  Effect.gen(function* () {
    const other = yield* Effect.promise(() =>
      world.t.mutation((ctx) =>
        seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix })
      )
    );
    return yield* client(
      world.t.withIdentity({
        sessionId: other.sessionId,
        subject: other.authUserId,
      })
    ).mutation(tryouts.mutations.attempts.startAttempt, startArgs());
  });

/** Runs one direct change against the world's scale rows. */
const change = (
  world: TryoutWorld,
  edit: (ctx: MutationCtx) => Promise<unknown>
) => Effect.promise(() => world.t.mutation(edit));

describe("tryouts/start/scale", () => {
  it.effect(
    "publishes a provisional scale of the paper's families on the first IRT start, and reuses it",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
        const first = yield* world.start();
        const created = yield* readScales(world);
        expect(created.scales).toMatchObject([
          {
            assessmentSnapshotId: world.snapshotId,
            model: "2pl",
            questionCount: 3,
            setIdentity: "indonesia/snbt/2027/set-1",
            status: "provisional",
          },
        ]);
        expect(
          Arr.map(created.runs, ({ questionCount, sectionKey }) => [
            sectionKey,
            questionCount,
          ])
        ).toEqual([
          ["section-a", 2],
          ["section-b", 1],
        ]);
        expect(
          Arr.map(
            created.items,
            ({ calibrationStatus, difficulty, discrimination, family }) => [
              family,
              calibrationStatus,
              difficulty,
              discrimination,
            ]
          )
        ).toEqual([
          ["section-a-item-1", "provisional", 0, 1],
          ["section-a-item-2", "provisional", 0, 1],
          ["section-b-item-1", "provisional", 0, 1],
        ]);
        const second = yield* startAsAnother(world, "second");
        expect(yield* readScales(world)).toEqual(created);
        const attempts = yield* Effect.promise(() =>
          world.t.query(async (ctx) => [
            await ctx.db.get("tryoutAttempts", first.attemptId),
            await ctx.db.get("tryoutAttempts", second.attemptId),
          ])
        );
        expect(Arr.map(attempts, (attempt) => attempt?.scaleVersionId)).toEqual(
          [created.scales[0]?._id, created.scales[0]?._id]
        );
      })
  );

  it.effect(
    "carries each family's calibration into the scale of a later snapshot, official only when every family carries over",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
        yield* world.start();
        yield* change(world, async (ctx) => {
          const [scale] = await ctx.db.query("irtScaleVersions").collect();
          assert.ok(scale);
          await ctx.db.patch("irtScaleVersions", scale._id, {
            status: "official",
          });
          for (const item of await ctx.db.query("irtScaleItems").collect()) {
            await ctx.db.patch("irtScaleItems", item._id, {
              calibrationStatus: "calibrated",
              difficulty: 0.5,
            });
          }
        });
        yield* world.release({ renamed: true, scoring: { kind: "irt" } });
        yield* startAsAnother(world, "later");
        const { items, scales } = yield* readScales(world);
        const [, later] = scales;
        expect(later).toMatchObject({ questionCount: 3, status: "official" });
        expect(
          Arr.map(
            Arr.filter(items, (item) => item.scaleVersionId === later?._id),
            ({ calibrationStatus, difficulty }) => [
              calibrationStatus,
              difficulty,
            ]
          )
        ).toEqual([
          ["calibrated", 0.5],
          ["calibrated", 0.5],
          ["calibrated", 0.5],
        ]);
      })
  );

  it.effect(
    "refuses a start against duplicate, mismatched, incomplete, or repeating scales",
    () =>
      Effect.gen(function* () {
        const cases: readonly ((ctx: MutationCtx) => Promise<unknown>)[] = [
          async (ctx) => {
            const [scale] = await ctx.db.query("irtScaleVersions").collect();
            assert.ok(scale);
            await ctx.db.insert(
              "irtScaleVersions",
              Struct.omit(scale, ["_creationTime", "_id"])
            );
          },
          async (ctx) => {
            const [scale] = await ctx.db.query("irtScaleVersions").collect();
            assert.ok(scale);
            await ctx.db.patch("irtScaleVersions", scale._id, {
              questionCount: 2,
            });
          },
          async (ctx) => {
            const [item] = await ctx.db.query("irtScaleItems").collect();
            assert.ok(item);
            await ctx.db.delete("irtScaleItems", item._id);
          },
          async (ctx) => {
            const [first, second] = await ctx.db
              .query("irtScaleItems")
              .collect();
            assert.ok(first && second);
            await ctx.db.patch("irtScaleItems", second._id, {
              family: first.family,
            });
          },
          async (ctx) => {
            const [first] = await ctx.db.query("irtScaleItems").collect();
            assert.ok(first);
            await ctx.db.patch("irtScaleItems", first._id, {
              family: "other-family",
            });
          },
        ];
        yield* Effect.forEach(
          cases,
          (arrange, index) =>
            Effect.gen(function* () {
              const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
              yield* world.start();
              yield* change(world, arrange);
              expect(
                yield* startAsAnother(world, `refused-${index}`).pipe(
                  Effect.flip
                )
              ).toMatchObject({ code: "TRYOUT_IRT_SCALE_REQUIRED" });
            }),
          { discard: true }
        );
      })
  );
});

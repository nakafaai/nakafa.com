import type { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { ItemFamilyIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import type databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadAttemptIrtSource,
  loadSectionIrtSource,
} from "@repo/backend/confect/tryouts/runtime/irt/items";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Schema, Struct } from "effect";

type MutationServices = RegisteredConvexFunction.MutationServices<
  typeof databaseSchema
>;

/** An item family no place of the fixture holds. */
const ABSENT_FAMILY = Schema.decodeSync(ItemFamilyIdSchema)("section-b-item-9");

/** An IRT-scored fixture attempt with its provisional scale, its places in order, and its scale items. */
const seedScaled = Effect.gen(function* () {
  const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
  const { attemptId } = yield* world.start();
  const rows = yield* world.run(
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return {
        attempt: yield* database.table("tryoutAttempts").get(attemptId),
        placements: yield* database
          .table("tryoutAttemptPlacements")
          .index(
            "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
            (query) => query.eq("tryoutAttemptId", attemptId)
          )
          .collect(),
      };
    }).pipe(Effect.orDie)
  );
  const [first, second, third] = rows.placements;
  assert.ok(first && second && third, "Expected the three fixture places.");
  /** Runs one direct change against the stored scale rows. */
  const change = (edit: (ctx: MutationCtx) => Promise<unknown>) =>
    Effect.promise(() => world.t.mutation(edit));
  /** The code a load fails with, read inside its transaction. */
  const codeOf = <A, E extends { readonly code: string }>(
    load: Effect.Effect<A, E, MutationServices>
  ) =>
    world.run(
      load.pipe(
        Effect.flip,
        Effect.map(({ code }) => code)
      )
    );
  return {
    ...rows,
    change,
    codeOf,
    places: { first, second, third },
    sectionA: [first, second],
    world,
  };
});

describe("tryouts/runtime/irt/items", () => {
  it.effect(
    "loads the attempt's scale with one item per place, and a section's items through its calibration run",
    () =>
      Effect.gen(function* () {
        const { attempt, placements, sectionA, world } = yield* seedScaled;
        const whole = yield* world.run(
          loadAttemptIrtSource(attempt, placements)
        );
        expect(whole.scale).toMatchObject({ questionCount: 3 });
        expect(Arr.map(whole.items, ({ placementId }) => placementId)).toEqual(
          Arr.map(placements, ({ _id }) => _id)
        );
        const section = yield* world.run(
          loadSectionIrtSource({
            attempt,
            placements: sectionA,
            sectionKey: "section-a",
          })
        );
        expect(Arr.map(section.items, ({ item }) => item.family)).toEqual([
          "section-a-item-1",
          "section-a-item-2",
        ]);
      })
  );

  it.effect(
    "refuses an attempt without its own scale, or whose scale counts other questions",
    () =>
      Effect.gen(function* () {
        const { attempt, change, codeOf, placements } = yield* seedScaled;
        const { scaleVersionId, ...unscaled } = attempt;
        assert.ok(scaleVersionId, "Expected the attempt's scale.");
        for (const changed of [
          unscaled,
          { ...attempt, setIdentity: "indonesia/snbt/2027/set-2" },
          { ...attempt, assessmentSnapshotId: "another-snapshot" },
        ]) {
          expect(yield* codeOf(loadAttemptIrtSource(changed, placements))).toBe(
            "TRYOUT_IRT_SCALE_REQUIRED"
          );
        }
        expect(
          yield* codeOf(
            loadAttemptIrtSource({ ...attempt, totalQuestions: 4 }, placements)
          )
        ).toBe("TRYOUT_IRT_SCALE_COUNT_MISMATCH");
        yield* change((ctx) =>
          ctx.db.delete("irtScaleVersions", scaleVersionId)
        );
        expect(yield* codeOf(loadAttemptIrtSource(attempt, placements))).toBe(
          "TRYOUT_IRT_SCALE_REQUIRED"
        );
      })
  );

  it.effect(
    "refuses a section without exactly one completed run of its question count",
    () =>
      Effect.gen(function* () {
        const { attempt, change, codeOf, places, sectionA } = yield* seedScaled;
        const section = (sectionKey: string, placements = sectionA) =>
          codeOf(loadSectionIrtSource({ attempt, placements, sectionKey }));
        expect(yield* section("section-z")).toBe(
          "TRYOUT_IRT_CALIBRATION_RUN_MISMATCH"
        );
        expect(yield* section("section-a", [places.first])).toBe(
          "TRYOUT_IRT_CALIBRATION_RUN_MISMATCH"
        );
        yield* change(async (ctx) => {
          for (const run of await ctx.db
            .query("irtCalibrationRuns")
            .collect()) {
            await ctx.db.patch("irtCalibrationRuns", run._id, {
              status: "running",
            });
          }
        });
        expect(yield* section("section-a")).toBe(
          "TRYOUT_IRT_CALIBRATION_RUN_MISMATCH"
        );
      })
  );

  it.effect(
    "refuses items that miss a place, repeat a family, belong to another scale, or calibrate a family no place holds",
    () =>
      Effect.gen(function* () {
        const { attempt, change, codeOf, places, placements, sectionA } =
          yield* seedScaled;
        const whole = (changed: typeof placements) =>
          codeOf(loadAttemptIrtSource(attempt, changed));
        expect(yield* whole([places.first, places.second])).toBe(
          "TRYOUT_IRT_ITEM_COUNT_MISMATCH"
        );
        expect(
          yield* whole([
            places.first,
            { ...places.second, family: places.first.family },
            places.third,
          ])
        ).toBe("TRYOUT_PLACEMENT_DUPLICATE");
        expect(
          yield* whole([
            places.first,
            places.second,
            { ...places.third, family: ABSENT_FAMILY },
          ])
        ).toBe("TRYOUT_IRT_ITEM_STALE");
        yield* change(async (ctx) => {
          const [item, other] = await ctx.db.query("irtScaleItems").collect();
          assert.ok(item && other, "Expected two scale items.");
          const scale = await ctx.db.get(
            "irtScaleVersions",
            item.scaleVersionId
          );
          assert.ok(scale, "Expected the scale.");
          await ctx.db.patch("irtScaleItems", other._id, {
            scaleVersionId: await ctx.db.insert(
              "irtScaleVersions",
              Struct.omit(scale, ["_creationTime", "_id"])
            ),
          });
        });
        expect(
          yield* codeOf(
            loadSectionIrtSource({
              attempt,
              placements: sectionA,
              sectionKey: "section-a",
            })
          )
        ).toBe("TRYOUT_IRT_ITEM_STALE");
        yield* change(async (ctx) => {
          const [item, other] = await ctx.db.query("irtScaleItems").collect();
          assert.ok(item && other, "Expected two scale items.");
          await ctx.db.patch("irtScaleItems", other._id, {
            family: item.family,
            scaleVersionId: item.scaleVersionId,
          });
        });
        expect(yield* whole(placements)).toBe("TRYOUT_IRT_ITEM_DUPLICATE");
      })
  );
});

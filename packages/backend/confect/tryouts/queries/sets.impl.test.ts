import { assert, describe, expect, it } from "@effect/vitest";
import {
  ContentSnapshotRowSchema,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { assessmentRowFacts } from "@repo/backend/confect/contentRelease/assessment/facts";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type {
  ListArgs,
  trackSetPageValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  FIXTURE_TRACK,
  makeAssessmentSnapshot,
} from "@repo/backend/test/assessment/snapshot";
import { client } from "@repo/backend/test/client";
import {
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Option, Schema, Struct } from "effect";

const list = tryouts.queries.sets.list;

/** The list arguments of the fixture track: every set in authored order, up to `numItems`. */
const listArgs = (
  overrides: Partial<
    Pick<ListArgs, "filter" | "locale" | "sort"> & ListArgs["paginationOpts"]
  > = {}
) => ({
  ...FIXTURE_TRACK,
  filter: overrides.filter ?? "all",
  locale: overrides.locale ?? "id",
  paginationOpts: {
    cursor: overrides.cursor ?? null,
    numItems: overrides.numItems ?? 25,
  },
  sort: overrides.sort ?? {
    direction: "asc" as const,
    field: "order" as const,
  },
});

/**
 * A track of three sets where the learner runs set 1, finished set 2 with its first question right,
 * and never started set 3.
 */
const seedTrack = Effect.gen(function* () {
  const world = yield* tryoutWorld({ sets: 3 });
  const running = yield* world.start();
  const finished = yield* world.start({ setKey: "set-2" });
  yield* world.startSection(finished.attemptId, "section-a");
  yield* world.answer(finished.attemptId, {
    order: 1,
    pick: "correct",
    section: "section-a",
  });
  yield* world.completeSection(finished.attemptId, "section-a");
  yield* world.startSection(finished.attemptId, "section-b");
  yield* world.completeSection(finished.attemptId, "section-b");
  return { running: running.attemptId, world };
});

/** The set keys of one page, in order. */
const keysOf = (page: typeof trackSetPageValidator.Type) =>
  Arr.map(page.page, ({ setKey }) => setKey);

/**
 * Encodes the fixture's Indonesian catalog row of one set as a stored row, with the order and the
 * route `change` gives from its route.
 */
const encodeSetRow = (
  setKey: string,
  change: (publicPath: string) => {
    readonly order: number;
    readonly publicPath: string;
  }
) =>
  Effect.gen(function* () {
    const { catalog } = yield* makeAssessmentSnapshot({ sets: 3 });
    const set = Arr.findFirst(
      catalog,
      (row) =>
        row.kind === "set" && row.setKey === setKey && row.appLocale === "id"
    );
    assert.ok(
      Option.isSome(set) && set.value.kind === "set",
      "Expected the fixture set row."
    );
    const row = yield* Schema.decodeEffect(ContentSnapshotRowSchema)({
      family: "assessment",
      record: {
        row: {
          kind: "catalog",
          row: { ...set.value, ...change(set.value.publicPath) },
        },
        rowHash: `sha256:${"c".repeat(64)}`,
      },
    });
    assert.ok(row.family === "assessment");
    return {
      ...assessmentRowFacts(row.record.row),
      publicPath: set.value.publicPath,
      rowHash: row.record.rowHash,
      rowJson: canonicalizeContentSnapshotRow(row),
    };
  });

/** Stores another copy of a set's catalog row in the active snapshot, at another route. */
const insertSetCopy = (world: TryoutWorld, setKey: string) =>
  Effect.gen(function* () {
    const { publicPath, ...stored } = yield* encodeSetRow(setKey, (path) => ({
      order: 99,
      publicPath: `${path}-copy`,
    }));
    yield* Effect.promise(() =>
      world.t.mutation((ctx) =>
        ctx.db.insert("assessmentRows", {
          ...stored,
          identity: `copy-${setKey}`,
          index: 9999,
          snapshotId: world.snapshotId,
        })
      )
    );
  });

/** Moves one set of the active snapshot to another authored order, keeping its route. */
const reorderSet = (world: TryoutWorld, setKey: string, order: number) =>
  Effect.gen(function* () {
    const stored = yield* encodeSetRow(setKey, (publicPath) => ({
      order,
      publicPath,
    }));
    yield* Effect.promise(() =>
      world.t.mutation(async (ctx) => {
        const row = await ctx.db
          .query("assessmentRows")
          .withIndex("by_snapshotId_and_appLocale_and_publicPath", (query) =>
            query
              .eq("snapshotId", world.snapshotId)
              .eq("appLocale", "id")
              .eq("publicPath", stored.publicPath)
          )
          .unique();
        assert.ok(row, "Expected the stored set row.");
        await ctx.db.patch("assessmentRows", row._id, stored);
      })
    );
  });

/** Changes the learner's progress row of one set. */
const patchProgress = (
  world: TryoutWorld,
  setKey: string,
  change: (ctx: MutationCtx, id: Id<"tryoutSetProgress">) => Promise<unknown>
) =>
  Effect.promise(() =>
    world.t.mutation(async (ctx) => {
      const rows = await ctx.db.query("tryoutSetProgress").collect();
      const row = Arr.findFirst(
        rows,
        (candidate) => candidate.setKey === setKey
      );
      assert.ok(Option.isSome(row), "Expected the set's progress.");
      await change(ctx, row.value._id);
    })
  );

describe("tryouts/queries/sets", () => {
  it.effect("requires an active release", () =>
    Effect.gen(function* () {
      expect(
        yield* client(createConvexTestWithBetterAuth())
          .query(list, listArgs())
          .pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_MISSING",
      });
    })
  );

  it.effect(
    "lists a track's sets in authored order with their facts, for a visitor without progress",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ sets: 2 });
        const page = yield* world.visitor.query(list, listArgs());
        expect(page).toMatchObject({
          isDone: true,
          page: [
            {
              attemptStatus: null,
              durationSeconds: 900,
              publishedScore: null,
              questionCount: 3,
              runningAttempt: null,
              sectionCount: 2,
              setKey: "set-1",
              visibleSectionCount: 2,
            },
            { setKey: "set-2" },
          ],
          snapshotId: world.snapshotId,
          viewerId: null,
        });
        expect(
          yield* world.visitor.query(list, { ...listArgs(), trackKey: "2099" })
        ).toMatchObject({ isDone: true, page: [] });
      })
  );

  it.effect(
    "joins the learner's progress, links a running attempt, and filters and sorts before paging",
    () =>
      Effect.gen(function* () {
        const { running, world } = yield* seedTrack;
        const all = yield* world.learner.query(list, listArgs());
        expect(all.page).toMatchObject([
          {
            attemptStatus: "in-progress",
            publishedScore: null,
            runningAttempt: {
              attemptId: running,
              publicPath: "try-out/indonesia/snbt/2027/set-1-id",
            },
            setKey: "set-1",
          },
          {
            attemptStatus: "completed",
            publishedScore: 33,
            runningAttempt: null,
            setKey: "set-2",
          },
          { attemptStatus: null, setKey: "set-3" },
        ]);
        for (const [filter, keys] of [
          ["in-progress", ["set-1"]],
          ["completed", ["set-2"]],
          ["not-started", ["set-3"]],
        ] as const) {
          expect(
            keysOf(yield* world.learner.query(list, listArgs({ filter })))
          ).toEqual(keys);
        }
        for (const [sort, keys] of [
          [
            { direction: "desc", field: "publishedScore" },
            ["set-2", "set-1", "set-3"],
          ],
          [
            { direction: "asc", field: "publishedScore" },
            ["set-2", "set-1", "set-3"],
          ],
          [{ direction: "desc", field: "order" }, ["set-3", "set-2", "set-1"]],
          [
            { direction: "asc", field: "questionCount" },
            ["set-1", "set-2", "set-3"],
          ],
          [
            { direction: "desc", field: "durationSeconds" },
            ["set-1", "set-2", "set-3"],
          ],
          [{ direction: "asc", field: "title" }, ["set-1", "set-2", "set-3"]],
        ] as const) {
          expect(
            keysOf(yield* world.learner.query(list, listArgs({ sort })))
          ).toEqual(keys);
        }
      })
  );

  it.effect(
    "sorts scored sets by score ahead of unscored ones, and breaks an order tie by set identity",
    () =>
      Effect.gen(function* () {
        const { world } = yield* seedTrack;
        yield* patchProgress(world, "set-1", (ctx, id) =>
          ctx.db.patch("tryoutSetProgress", id, { publishedScore: 50 })
        );
        for (const [direction, keys] of [
          ["desc", ["set-1", "set-2", "set-3"]],
          ["asc", ["set-2", "set-1", "set-3"]],
        ] as const) {
          expect(
            keysOf(
              yield* world.learner.query(
                list,
                listArgs({ sort: { direction, field: "publishedScore" } })
              )
            )
          ).toEqual(keys);
        }
        yield* reorderSet(world, "set-3", 1);
        expect(keysOf(yield* world.learner.query(list, listArgs()))).toEqual([
          "set-1",
          "set-3",
          "set-2",
        ]);
      })
  );

  it.effect(
    "pages by an exact-state cursor and asks the client to restart once the rows change",
    () =>
      Effect.gen(function* () {
        const { world } = yield* seedTrack;
        const first = yield* world.learner.query(
          list,
          listArgs({ numItems: 2 })
        );
        expect(keysOf(first)).toEqual(["set-1", "set-2"]);
        expect(first.isDone).toBe(false);
        const second = yield* world.learner.query(
          list,
          listArgs({ cursor: first.continueCursor, numItems: 2 })
        );
        expect(second).toMatchObject({ continueCursor: "", isDone: true });
        expect(keysOf(second)).toEqual(["set-3"]);
        for (const cursor of [
          "elsewhere",
          `${first.continueCursor.slice(0, -1)}x`,
        ]) {
          expect(
            yield* world.learner
              .query(list, listArgs({ cursor, numItems: 2 }))
              .pipe(Effect.flip)
          ).toMatchObject({ code: "INVALID_TRYOUT_SET_CURSOR" });
        }
        yield* world.start({ setKey: "set-3" });
        expect(
          yield* world.learner
            .query(
              list,
              listArgs({ cursor: first.continueCursor, numItems: 2 })
            )
            .pipe(Effect.flip)
        ).toMatchObject({ code: "INVALID_TRYOUT_SET_CURSOR" });
        for (const numItems of [0, 1.5]) {
          expect(
            yield* world.learner
              .query(list, listArgs({ numItems }))
              .pipe(Effect.flip)
          ).toMatchObject({ code: "INVALID_TRYOUT_SET_PAGE_SIZE" });
        }
      })
  );

  it.effect(
    "fails closed on progress stored twice, oversized, or naming another set, and on a set listed twice",
    () =>
      Effect.gen(function* () {
        const cases = [
          (world: TryoutWorld) =>
            patchProgress(world, "set-1", async (ctx, id) => {
              const row = await ctx.db.get("tryoutSetProgress", id);
              assert.ok(row);
              await ctx.db.insert(
                "tryoutSetProgress",
                Struct.omit(row, ["_creationTime", "_id"])
              );
            }),
          (world: TryoutWorld) =>
            patchProgress(world, "set-1", (ctx, id) =>
              ctx.db.patch("tryoutSetProgress", id, {
                setIdentity: "x".repeat(4096),
              })
            ),
          (world: TryoutWorld) =>
            patchProgress(world, "set-1", (ctx, id) =>
              ctx.db.patch("tryoutSetProgress", id, {
                setIdentity: "indonesia/snbt/2027/set-9",
              })
            ),
          (world: TryoutWorld) => insertSetCopy(world, "set-1"),
        ];
        for (const arrange of cases) {
          const { world } = yield* seedTrack;
          yield* arrange(world);
          expect(
            yield* world.learner.query(list, listArgs()).pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        }
      })
  );

  it.effect(
    "leaves a running link off progress whose attempt already ended",
    () =>
      Effect.gen(function* () {
        const { running, world } = yield* seedTrack;
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("tryoutAttempts", running, {
              completedAt: TRYOUT_NOW,
              endReason: "time-expired",
              status: "expired",
            })
          )
        );
        const page = yield* world.learner.query(list, listArgs());
        expect(page.page[0]).toMatchObject({
          attemptStatus: "in-progress",
          runningAttempt: null,
        });
      })
  );

  it.effect(
    "leaves a running link off a set whose attempt's snapshot lost it in the listed locale",
    () =>
      Effect.gen(function* () {
        const { running, world } = yield* seedTrack;
        yield* world.release({ renamed: true, sets: 3 });
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const attempt = await ctx.db.get("tryoutAttempts", running);
            assert.ok(attempt, "Expected the running attempt.");
            for (const row of await ctx.db
              .query("assessmentRows")
              .withIndex(
                "by_snapshotId_and_setIdentity_and_appLocale_and_order",
                (query) =>
                  query
                    .eq("snapshotId", world.snapshotId)
                    .eq("setIdentity", attempt.setIdentity)
                    .eq("appLocale", "en")
              )
              .collect()) {
              await ctx.db.delete("assessmentRows", row._id);
            }
          })
        );
        const page = yield* world.learner.query(
          list,
          listArgs({ locale: "en" })
        );
        expect(page.page[0]).toMatchObject({
          attemptStatus: "in-progress",
          runningAttempt: null,
          setKey: "set-1",
        });
      })
  );
});

import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  reconcileMissedAttemptExpiries,
  reconcileMissedSectionExpiries,
  startExpirySweep,
} from "@repo/backend/confect/tryouts/mutations/expiry";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { inMutation } from "@repo/backend/test/client";
import {
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect } from "effect";

const ATTEMPT_END = TRYOUT_NOW + 3 * 86_400_000;
const SECTION_END = TRYOUT_NOW + 600_000;
const expiry = refs.internal.tryouts.mutations.expiry;

/** Reads an attempt, its section attempts in order, its score, and the jobs scheduled so far. */
const readExpiry = (world: TryoutWorld, attemptId: Id<"tryoutAttempts">) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      attempt: await ctx.db.get("tryoutAttempts", attemptId),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      score: await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (query) =>
          query.eq("tryoutAttemptId", attemptId)
        )
        .unique(),
      sections: await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
          query.eq("tryoutAttemptId", attemptId)
        )
        .collect(),
    }))
  );

/** Starts the fixture set with section A running and its first question answered right. */
const seedRunning = Effect.gen(function* () {
  const world = yield* tryoutWorld();
  const { attemptId } = yield* world.start();
  yield* world.startSection(attemptId, "section-a");
  yield* world.answer(attemptId, {
    order: 1,
    pick: "correct",
    section: "section-a",
  });
  const [section] = (yield* readExpiry(world, attemptId)).sections;
  if (!section) {
    return yield* Effect.die("Expected the running section.");
  }
  return { attemptId, sectionAttemptId: section._id, world };
});

describe("tryouts/mutations/expiry", () => {
  it.effect(
    "expires a lapsed attempt: ends its running section, records the unopened one, and scores it",
    () =>
      Effect.gen(function* () {
        const { attemptId, world } = yield* seedRunning;
        vi.setSystemTime(ATTEMPT_END);
        yield* world.internal.mutation(expiry.attempt, {
          attemptId,
          expiresAt: ATTEMPT_END,
        });
        const rows = yield* readExpiry(world, attemptId);
        expect(rows.attempt).toMatchObject({
          completedSectionKeys: ["section-a", "section-b"],
          endReason: "time-expired",
          status: "expired",
        });
        expect(rows.sections).toMatchObject([
          {
            answeredCount: 1,
            correctAnswers: 1,
            endReason: "time-expired",
            sectionKey: "section-a",
            status: "expired",
          },
          {
            answeredCount: 0,
            endReason: "time-expired",
            score: { rawScore: 0 },
            sectionKey: "section-b",
            startedAt: ATTEMPT_END,
            status: "expired",
          },
        ]);
        expect(rows.score).toMatchObject({ rawScore: 33, totalCorrect: 1 });
      })
  );

  it.effect(
    "keeps a finished section as it ended when the attempt lapses during the next one",
    () =>
      Effect.gen(function* () {
        const { attemptId, world } = yield* seedRunning;
        yield* world.completeSection(attemptId, "section-a");
        yield* world.startSection(attemptId, "section-b");
        vi.setSystemTime(ATTEMPT_END);
        yield* world.internal.mutation(expiry.attempt, {
          attemptId,
          expiresAt: ATTEMPT_END,
        });
        const rows = yield* readExpiry(world, attemptId);
        expect(rows.attempt).toMatchObject({ status: "expired" });
        expect(rows.sections).toMatchObject([
          {
            endReason: "submitted",
            sectionKey: "section-a",
            status: "completed",
          },
          {
            endReason: "time-expired",
            sectionKey: "section-b",
            status: "expired",
          },
        ]);
      })
  );

  it.effect(
    "ignores an attempt or section job that no longer matches its row, or whose row is gone",
    () =>
      Effect.gen(function* () {
        const { attemptId, sectionAttemptId, world } = yield* seedRunning;
        vi.setSystemTime(ATTEMPT_END);
        const before = yield* readExpiry(world, attemptId);
        yield* world.internal.mutation(expiry.attempt, {
          attemptId,
          expiresAt: ATTEMPT_END - 1,
        });
        yield* world.internal.mutation(expiry.section, {
          expiresAt: SECTION_END - 1,
          sectionAttemptId,
        });
        expect(yield* readExpiry(world, attemptId)).toEqual(before);
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            await ctx.db.delete("tryoutSectionAttempts", sectionAttemptId);
            await ctx.db.delete("tryoutAttempts", attemptId);
          })
        );
        yield* world.internal.mutation(expiry.attempt, {
          attemptId,
          expiresAt: ATTEMPT_END,
        });
        yield* world.internal.mutation(expiry.section, {
          expiresAt: SECTION_END,
          sectionAttemptId,
        });
        expect((yield* readExpiry(world, attemptId)).attempt).toBeNull();
      })
  );

  it.effect(
    "ends a lapsed section of a live attempt, and the whole attempt once the attempt lapsed too",
    () =>
      Effect.gen(function* () {
        const live = yield* seedRunning;
        vi.setSystemTime(SECTION_END);
        yield* live.world.internal.mutation(expiry.section, {
          expiresAt: SECTION_END,
          sectionAttemptId: live.sectionAttemptId,
        });
        const ended = yield* readExpiry(live.world, live.attemptId);
        expect(ended.attempt).toMatchObject({
          completedSectionKeys: ["section-a"],
          status: "in-progress",
        });
        expect(ended.sections).toMatchObject([
          { endReason: "time-expired", status: "expired" },
        ]);
        const lapsed = yield* seedRunning;
        yield* Effect.promise(() =>
          lapsed.world.t.mutation((ctx) =>
            ctx.db.patch("tryoutAttempts", lapsed.attemptId, {
              expiresAt: SECTION_END,
            })
          )
        );
        vi.setSystemTime(SECTION_END);
        yield* lapsed.world.internal.mutation(expiry.section, {
          expiresAt: SECTION_END,
          sectionAttemptId: lapsed.sectionAttemptId,
        });
        expect(
          (yield* readExpiry(lapsed.world, lapsed.attemptId)).attempt
        ).toMatchObject({ endReason: "time-expired", status: "expired" });
      })
  );

  it.effect(
    "leaves a section job of a finished attempt, and refuses one whose attempt is missing",
    () =>
      Effect.gen(function* () {
        const { attemptId, sectionAttemptId, world } = yield* seedRunning;
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, { status: "completed" })
          )
        );
        vi.setSystemTime(SECTION_END);
        yield* world.internal.mutation(expiry.section, {
          expiresAt: SECTION_END,
          sectionAttemptId,
        });
        expect((yield* readExpiry(world, attemptId)).sections).toMatchObject([
          { status: "in-progress" },
        ]);
        yield* Effect.promise(() =>
          world.t.mutation((ctx) => ctx.db.delete("tryoutAttempts", attemptId))
        );
        expect(
          yield* world.internal
            .mutation(expiry.section, {
              expiresAt: SECTION_END,
              sectionAttemptId,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_ATTEMPT_NOT_FOUND" });
      })
  );

  it.effect(
    "sweeps missed expiries: one job per lapsed attempt, then one per lapsed section of another attempt",
    () =>
      Effect.gen(function* () {
        const { attemptId, sectionAttemptId, world } = yield* seedRunning;
        vi.setSystemTime(ATTEMPT_END + 1);
        const jobsBefore = (yield* readExpiry(world, attemptId)).jobs.length;
        yield* world.internal.mutation(expiry.sweep, {});
        yield* world.internal.mutation(expiry.reconcileAttempts, {
          before: ATTEMPT_END + 1,
        });
        yield* world.internal.mutation(expiry.reconcileSections, {
          before: ATTEMPT_END + 1,
          scheduledAttemptIds: [attemptId],
        });
        yield* world.internal.mutation(expiry.reconcileSections, {
          before: ATTEMPT_END + 1,
          scheduledAttemptIds: [],
        });
        const jobs = Arr.drop(
          (yield* readExpiry(world, attemptId)).jobs,
          jobsBefore
        );
        expect(Arr.map(jobs, ({ args }) => args[0])).toEqual([
          { before: ATTEMPT_END + 1 },
          { attemptId, expiresAt: ATTEMPT_END },
          { before: ATTEMPT_END + 1, scheduledAttemptIds: [attemptId] },
          { expiresAt: SECTION_END, sectionAttemptId },
        ]);
      })
  );

  it.effect.each([
    ["sweep", startExpirySweep()],
    ["attempt reconciliation", reconcileMissedAttemptExpiries(ATTEMPT_END + 1)],
    [
      "section reconciliation",
      reconcileMissedSectionExpiries({
        before: ATTEMPT_END + 1,
        scheduledAttemptIds: [],
      }),
    ],
  ] as const)("rolls back the %s if scheduling fails", ([, program]) =>
    Effect.gen(function* () {
      const { world } = yield* seedRunning;
      vi.setSystemTime(ATTEMPT_END + 1);
      yield* Effect.promise(() =>
        expect(
          world.t.mutation(async (ctx) => {
            vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValue(
              new Error("scheduler outage")
            );
            return await inMutation(() => program)(ctx);
          })
        ).rejects.toMatchObject({ code: "TRYOUT_RUNTIME_FAILED" })
      );
    })
  );
});

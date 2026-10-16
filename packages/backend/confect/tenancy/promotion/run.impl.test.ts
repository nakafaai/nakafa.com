import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  allJournal,
  approvedPromotion,
  drain,
  entriesOf,
  nf,
  periods,
  promotion,
  readPromotion,
  runJobs,
  runPromotion,
  scenario,
  toEightA,
  toEightB,
  toGraduate,
} from "@repo/backend/test/promotion";
import { suspend, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create, plan } = promotion.draft;
const { archive, unarchive } = refs.public.tenancy.units;
const { setMove } = promotion.moves;
const { apply } = promotion.apply;
const { approve, submit } = promotion.review;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotion run", () => {
  it.effect(
    "walks a draft to opened with two cohorts and a graduating grade, and journals each write of apply",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          sources: [
            { cohortId: s.seventh.id, homeroom: true, to: toEightA },
            { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
          ],
          targets: [
            { grade: 8, name: "8A" },
            { grade: 8, name: "8B" },
          ],
        });
        yield* fixture.as("admin").mutation(setMove, {
          personId: s.second,
          promotionId: made.id,
          slug: nf,
          to: toEightB,
        });
        yield* fixture
          .as("admin")
          .mutation(submit, { promotionId: made.id, slug: nf });
        yield* fixture
          .as("principal")
          .mutation(approve, { promotionId: made.id, slug: nf });
        const started = yield* fixture
          .as("admin")
          .mutation(apply, { promotionId: made.id, slug: nf });
        expect(started).toMatchObject({
          progress: { direction: "apply", running: true, step: "archive" },
          state: "applied",
        });
        const finished = yield* drain(fixture, made.id);
        expect(finished.progress).toEqual({
          cursor: null,
          direction: null,
          done: ["archive", "cohorts", "place", "homeroom"],
          failure: null,
          movedAt: expect.any(Number),
          running: false,
          step: null,
        });
        const journal = yield* fixture.run(allJournal);
        const applied = Arr.dropWhile(
          journal,
          (entry) => entry.change.type !== "promotion.applied"
        );
        const count = (type: string) =>
          Arr.filter(applied, (entry) => entry.change.type === type).length;
        expect([
          count("period.archived"),
          count("cohort.created"),
          count("person.moved"),
          count("person.graduated"),
          count("assignment.created"),
        ]).toEqual([1, 2, 2, 1, 1]);
        expect(
          Arr.every(
            applied,
            (entry) =>
              entry.actor.kind === "person" &&
              entry.actor.id === fixture.people.admin.personId
          )
        ).toBe(true);
        const opened = yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: s.target.id, slug: nf });
        expect(opened.status).toBe("active");
        expect(yield* entriesOf(fixture, "promotion.opened")).toHaveLength(1);
        expect((yield* readPromotion(fixture, made.id)).state).toBe("opened");
      })
  );

  it.effect(
    "hands the chain to the scheduler: apply schedules its first run, and each finished step schedules the next",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        expect(yield* fixture.run(runJobs)).toEqual([
          [{ actorId: fixture.people.admin.personId, promotionId }],
        ]);
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        expect(yield* fixture.run(runJobs)).toHaveLength(2);
      })
  );

  it.effect(
    "stops a run when its school is archived, writes nothing more, and resumes once the school is restored",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        // Only the archive step runs here, so the school is archived before the cohorts step.
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture
          .as("owner")
          .mutation(archive, { slug: nf, unitId: fixture.units.smp });
        const stopped = yield* drain(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          failure: "AccessDenied",
          running: false,
          step: "cohorts",
        });
        expect(stopped.created).toEqual([]);
        yield* fixture
          .as("owner")
          .mutation(unarchive, { slug: nf, unitId: fixture.units.smp });
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress.failure).toBeNull();
        expect(finished.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
          "homeroom",
        ]);
      })
  );

  it.effect(
    "stops a run when its tenant is suspended, writes nothing more, and resumes once the tenant is active again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.run(suspend(fixture.tenants.nf));
        const stopped = yield* drain(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          failure: "AccessDenied",
          running: false,
          step: "cohorts",
        });
        expect(stopped.created).toEqual([]);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenants")
              .patch(fixture.tenants.nf, { status: "active" })
          )
        );
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress.failure).toBeNull();
        expect(finished.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
          "homeroom",
        ]);
      })
  );

  it.effect("a run with nothing left to do changes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      yield* fixture.as("admin").mutation(plan, {
        promotionId: made.id,
        slug: nf,
        sources: [
          { cohortId: s.seventh.id, homeroom: true, to: toEightA },
          { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
        ],
        targets: [{ grade: 8, name: "8A" }],
      });
      yield* fixture
        .as("admin")
        .mutation(submit, { promotionId: made.id, slug: nf });
      yield* fixture
        .as("principal")
        .mutation(approve, { promotionId: made.id, slug: nf });
      yield* fixture
        .as("admin")
        .mutation(apply, { promotionId: made.id, slug: nf });
      const done = yield* drain(fixture, made.id);
      yield* fixture.internal.mutation(runPromotion, {
        actorId: fixture.people.admin.personId,
        promotionId: made.id,
      });
      expect(yield* readPromotion(fixture, made.id)).toEqual(done);
    })
  );
});

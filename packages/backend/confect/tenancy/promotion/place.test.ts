import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
import {
  approvedPromotion,
  cohort,
  crowd,
  drain,
  entriesOf,
  flipGrants,
  nf,
  placedStudent,
  placements,
  promotion,
  readPromotion,
  runJobs,
  runPromotion,
  scenario,
  scenarioPlan,
  snapshot,
  toEightA,
  toEightB,
  toGraduate,
  toStay,
  undoOnce,
} from "@repo/backend/test/promotion";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { create, plan } = promotion.draft;
const { setMove } = promotion.moves;
const { apply } = promotion.apply;
const { approve, submit } = promotion.review;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotion place pages", () => {
  it.effect(
    "stops at the page that failed, resumes there, and writes each student once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        const extra = yield* crowd(fixture, s.seventh.id, s.source.id, 150);
        const everyone = [s.first, s.second, s.third, ...extra];
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        // Apply's run, the archive and cohorts steps, and the first page each scheduled one run.
        expect(yield* fixture.run(runJobs)).toHaveLength(4);
        const firstPage = yield* readPromotion(fixture, promotionId);
        expect(firstPage.progress).toMatchObject({
          direction: "apply",
          running: true,
          step: "place",
        });
        expect(firstPage.progress.cursor).not.toBeNull();
        yield* flipGrants(fixture, everyone, "active", "revoked");
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const stopped = yield* readPromotion(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          failure: "PersonNotStudent",
          running: false,
          step: "place",
        });
        expect(stopped.progress.cursor).toBe(firstPage.progress.cursor);
        yield* flipGrants(fixture, everyone, "revoked", "active");
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
          "homeroom",
        ]);
        expect(yield* entriesOf(fixture, "person.moved")).toHaveLength(152);
        const state = yield* snapshot(fixture);
        expect(
          Arr.filter(state.placements, (row) => row.periodId === s.target.id)
        ).toHaveLength(152);
      })
  );
});

describe("tenancy/promotion place refusals", () => {
  it.effect(
    "stops the place step at a student who already holds the most placements",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.range(1, 63),
              (index) =>
                Effect.gen(function* () {
                  const periodId = yield* writer.table("tenantPeriods").insert({
                    end: `${2000 + index}-12-31`,
                    name: `Lama ${index}`,
                    start: `${2000 + index}-01-01`,
                    status: "archived",
                    tenantId: fixture.tenants.nf,
                    unitId: fixture.units.smp,
                  });
                  yield* writer.table("tenantCohortMembers").insert({
                    cohortId: s.seventh.id,
                    periodId,
                    personId: s.second,
                    tenantId: fixture.tenants.nf,
                  });
                }),
              { discard: true }
            )
          )
        );
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "PersonPlacementLimit",
          running: false,
          step: "place",
        });
      })
  );

  it.effect(
    "stops the place step at a student the target period already places by hand",
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
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const midway = yield* readPromotion(fixture, promotionId);
        const created = Option.getOrThrow(
          Arr.findFirst(midway.created, (entry) => entry.nameKey === "8a")
        );
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: created.cohortId,
          personId: s.first,
          slug: nf,
        });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "PersonAlreadyPlaced",
          running: false,
          step: "place",
        });
      })
  );

  it.effect(
    "stops the place step at a student of a cohort the plan never names",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const extra = yield* cohort(fixture, s.source.id, "7B", 7);
        yield* placedStudent(fixture, extra.id, "Siswa Tambahan");
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "PromotionPlanInvalid",
          running: false,
          step: "place",
        });
      })
  );

  it.effect(
    "stops the place step at a move to a cohort the plan no longer creates",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        const sources = [
          { cohortId: s.seventh.id, homeroom: true, to: toEightA },
          { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
        ];
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          sources,
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
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          sources,
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
        const finished = yield* drain(fixture, made.id);
        expect(finished.progress).toMatchObject({
          failure: "PromotionPlanInvalid",
          running: false,
          step: "place",
        });
      })
  );

  it.effect(
    "stops the place step at a graduate who already holds a placement in the target period, and graduates nobody",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const lain = yield* cohort(fixture, s.target.id, "Lain", 8);
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: lain.id,
          personId: s.third,
          slug: nf,
        });
        // The answer is read as a boolean inside the fixture: an Option copied out
        // of it loses the tag that `Option.isSome` reads.
        const holdsTargetPlace = fixture.run(
          Effect.map(placementOf(s.target.id, s.third), Option.isSome)
        );
        expect(yield* holdsTargetPlace).toBe(true);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "PersonAlreadyPlaced",
          running: false,
          step: "place",
        });
        expect(yield* entriesOf(fixture, "person.graduated")).toEqual([]);
        expect(yield* holdsTargetPlace).toBe(true);
        const undone = yield* undoOnce(fixture, promotionId);
        const reverted = yield* undoOnce(fixture, promotionId);
        expect(undone.progress.done).toEqual(["archive"]);
        expect(reverted.state).toBe("approved");
        expect(yield* holdsTargetPlace).toBe(true);
      })
  );

  it.effect(
    "stops the place step at a graduate move of a student who moved to a cohort of a lower grade",
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
          ...scenarioPlan(s.seventh, s.ninth),
        });
        yield* fixture.as("admin").mutation(setMove, {
          personId: s.third,
          promotionId: made.id,
          slug: nf,
          to: toGraduate,
        });
        yield* fixture.as("admin").mutation(placements.move, {
          cohortId: s.seventh.id,
          personId: s.third,
          slug: nf,
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
        const finished = yield* drain(fixture, made.id);
        expect(finished.progress).toMatchObject({
          failure: "PromotionPlanInvalid",
          running: false,
          step: "place",
        });
        expect(yield* entriesOf(fixture, "person.graduated")).toEqual([]);
      })
  );
});

describe("tenancy/promotion place destinations", () => {
  it.effect(
    "moves a student to the cohort their own move names, over the cohort's destination",
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
        yield* fixture
          .as("admin")
          .mutation(apply, { promotionId: made.id, slug: nf });
        const finished = yield* drain(fixture, made.id);
        const eightB = Option.getOrThrow(
          Arr.findFirst(finished.created, (entry) => entry.nameKey === "8b")
        );
        expect(finished.progress.failure).toBeNull();
        expect(yield* entriesOf(fixture, "person.moved")).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              change: expect.objectContaining({
                from: s.seventh.id,
                to: eightB.cohortId,
              }),
              subject: expect.objectContaining({ id: s.second }),
            }),
          ])
        );
      })
  );

  it.effect(
    "repeats the year of a cohort whose students stay, in a cohort of its own name and grade",
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
            { cohortId: s.seventh.id, homeroom: false, to: toStay },
            { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
          ],
          targets: [
            { grade: 8, name: "8A" },
            { grade: 7, name: "7A" },
          ],
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
        const finished = yield* drain(fixture, made.id);
        const repeat = Option.getOrThrow(
          Arr.findFirst(finished.created, (entry) => entry.nameKey === "7a")
        );
        expect(finished.progress.failure).toBeNull();
        expect(yield* entriesOf(fixture, "person.moved")).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              change: expect.objectContaining({
                from: s.seventh.id,
                to: repeat.cohortId,
              }),
            }),
          ])
        );
      })
  );
});

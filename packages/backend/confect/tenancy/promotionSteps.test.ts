import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import {
  allJournal,
  approvedPromotion,
  assignments,
  cohort,
  drain,
  entriesOf,
  flipStudentGrants,
  nf,
  people,
  placedStudent,
  promotionApply,
  readPromotion,
  runPromotion,
  scenario,
  snapshot,
  toEightA,
  toEightB,
  toGraduate,
  undoOnce,
} from "@repo/backend/test/promotion";
import { grantRole, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { apply, undo } = promotionApply;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

type Fixture = Effect.Success<typeof tenancyFixture>;

/** The cohort of the target period that the promotion created for a name. */
const createdFor = (
  fixture: Fixture,
  promotionId: GenericId.GenericId<"tenantPromotions">,
  nameKey: string
) =>
  Effect.map(readPromotion(fixture, promotionId), (row) =>
    Option.getOrThrow(
      Arr.findFirst(row.created, (entry) => entry.nameKey === nameKey)
    )
  );

describe("tenancy/promotionSteps undo", () => {
  it.effect(
    "undoes the steps last first, and restores every row exactly as it was before apply",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const before = yield* snapshot(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        const started = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf });
        expect(started.progress).toMatchObject({
          direction: "undo",
          running: true,
          step: "homeroom",
        });
        const afterHomeroom = yield* drain(fixture, promotionId);
        expect(afterHomeroom.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
        ]);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const reverted = yield* undoOnce(fixture, promotionId);
        expect(reverted).toMatchObject({
          progress: { done: [] },
          state: "approved",
        });
        expect(yield* snapshot(fixture)).toEqual(before);
        expect(yield* entriesOf(fixture, "promotion.undone")).toHaveLength(6);
        const refusal = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "PromotionState" });
      })
  );

  it.effect("applies again from the step after the last one undone", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const promotionId = yield* approvedPromotion(fixture, s);
      yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
      yield* drain(fixture, promotionId);
      yield* undoOnce(fixture, promotionId);
      const resumed = yield* fixture
        .as("admin")
        .mutation(apply, { promotionId, slug: nf });
      expect(resumed.progress).toMatchObject({
        direction: "apply",
        running: true,
        step: "homeroom",
      });
      const finished = yield* drain(fixture, promotionId);
      expect(finished.progress.done).toEqual([
        "archive",
        "cohorts",
        "place",
        "homeroom",
      ]);
      expect(yield* entriesOf(fixture, "assignment.created")).toHaveLength(3);
    })
  );

  it.effect(
    "undoes a homeroom copy that was removed by hand, without failing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const before = yield* snapshot(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        yield* fixture.as("admin").mutation(assignments.unassign, {
          cohortId: eightA.cohortId,
          slug: nf,
        });
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        expect(yield* snapshot(fixture)).toEqual(before);
      })
  );

  it.effect(
    "refuses to undo the cohorts while a student was added to one by hand, and resumes once that student is removed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const before = yield* snapshot(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        const added = yield* placedStudent(
          fixture,
          eightA.cohortId,
          "Siswa Manual"
        );
        const stopped = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf })
          .pipe(Effect.andThen(drain(fixture, promotionId)));
        expect(stopped.progress).toMatchObject({
          direction: "undo",
          failure: "PromotionCohortOccupied",
          running: false,
          step: "cohorts",
        });
        const applyWhileStopped = yield* fixture
          .as("admin")
          .mutation(apply, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(applyWhileStopped).toMatchObject({ _tag: "PromotionState" });
        yield* fixture
          .as("admin")
          .mutation(people.remove, { personId: added, slug: nf });
        yield* fixture.as("admin").mutation(undo, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        expect(yield* snapshot(fixture)).toEqual(before);
      })
  );

  it.effect(
    "undoes a stopped apply: the steps it finished come back first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const before = yield* snapshot(fixture);
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
        yield* flipStudentGrants(
          fixture,
          [s.first, s.second, s.third],
          "active",
          "revoked"
        );
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const stopped = yield* readPromotion(fixture, promotionId);
        expect(stopped.progress).toMatchObject({
          direction: "apply",
          failure: "PersonNotStudent",
          step: "place",
        });
        const undone = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf });
        expect(undone.progress).toMatchObject({
          direction: "undo",
          running: true,
          step: "cohorts",
        });
        yield* drain(fixture, promotionId);
        yield* undoOnce(fixture, promotionId);
        expect(yield* snapshot(fixture)).toEqual(before);
      })
  );

  it.effect(
    "refuses to apply a promotion whose steps all finished, and to undo one that is not applied",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        const onApproved = yield* fixture
          .as("admin")
          .mutation(undo, { promotionId, slug: nf })
          .pipe(Effect.flip);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* drain(fixture, promotionId);
        const again = yield* fixture
          .as("admin")
          .mutation(apply, { promotionId, slug: nf })
          .pipe(Effect.flip);
        expect(onApproved).toMatchObject({ _tag: "PromotionState" });
        expect(again).toMatchObject({ _tag: "PromotionState" });
      })
  );

  it.effect("logs every undone write with the step it undid", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const promotionId = yield* approvedPromotion(fixture, s);
      yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
      yield* drain(fixture, promotionId);
      yield* undoOnce(fixture, promotionId);
      const undone = Arr.filter(
        yield* fixture.run(allJournal),
        (entry) => entry.change.type === "promotion.undone"
      );
      expect(undone).toMatchObject([
        {
          actor: { id: fixture.people.admin.personId, kind: "person" },
          change: { step: "homeroom" },
          subject: { id: promotionId, kind: "promotion" },
        },
      ]);
    })
  );
});

describe("tenancy/promotionSteps apply failures", () => {
  it.effect(
    "stops the cohorts step at a name that a cohort of the target period took after approval",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* cohort(fixture, s.target.id, "8a", 8);
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "CohortNameTaken",
          running: false,
          step: "cohorts",
        });
      })
  );

  it.effect(
    "stops the cohorts step when the target period holds the most cohorts it can",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.makeBy(COHORT_LIMIT, (index) => index),
              (index) =>
                writer.table("tenantCohorts").insert({
                  grade: 1,
                  name: `Kelas ${index}`,
                  nameKey: `kelas ${index}`,
                  periodId: s.target.id,
                  status: "active",
                  tenantId: fixture.tenants.nf,
                  unitId: fixture.units.smp,
                }),
              { discard: true }
            )
          )
        );
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "CohortLimit",
          running: false,
          step: "cohorts",
        });
      })
  );

  it.effect(
    "stops the homeroom step at a cohort that already has a homeroom teacher",
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
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId: eightA.cohortId,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "CohortHasHomeroom",
          running: false,
          step: "homeroom",
        });
      })
  );

  it.effect(
    "stops the homeroom step at a teacher who leads another cohort of the target period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s, {
          sources: [
            { cohortId: s.seventh.id, homeroom: true, to: toEightA },
            { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
          ],
          targets: [
            { grade: 8, name: "8A" },
            { grade: 8, name: "8B" },
          ],
        });
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        const eightB = yield* createdFor(fixture, promotionId, "8b");
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId: eightB.cohortId,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "TeacherHasHomeroom",
          running: false,
          step: "homeroom",
        });
      })
  );

  it.effect("refuses to copy two homeroom teachers into one cohort", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const seventhB = yield* cohort(fixture, s.source.id, "7B", 7);
      const second = yield* fixture
        .as("admin")
        .mutation(people.create, { name: "Guru Kedua", slug: nf });
      yield* fixture.run(
        grantRole(fixture.tenants.nf, second.id, "teacher", {
          kind: "unit",
          unitId: fixture.units.smp,
        })
      );
      yield* fixture.as("admin").mutation(assignments.assign, {
        cohortId: seventhB.id,
        personId: second.id,
        slug: nf,
      });
      const promotionId = yield* approvedPromotion(fixture, s, {
        sources: [
          { cohortId: s.seventh.id, homeroom: true, to: toEightA },
          { cohortId: seventhB.id, homeroom: true, to: toEightA },
          { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
        ],
        targets: [{ grade: 8, name: "8A" }],
      });
      yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
      const finished = yield* drain(fixture, promotionId);
      expect(finished.progress).toMatchObject({
        failure: "CohortHasHomeroom",
        running: false,
        step: "homeroom",
      });
    })
  );

  it.effect(
    "copies a homeroom teacher only where a source cohort has one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const seventhB = yield* cohort(fixture, s.source.id, "7B", 7);
        const promotionId = yield* approvedPromotion(fixture, s, {
          sources: [
            { cohortId: s.seventh.id, homeroom: true, to: toEightA },
            { cohortId: seventhB.id, homeroom: true, to: toEightB },
            { cohortId: s.ninth.id, homeroom: false, to: toGraduate },
          ],
          targets: [
            { grade: 8, name: "8A" },
            { grade: 8, name: "8B" },
          ],
        });
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        const eightA = yield* createdFor(fixture, promotionId, "8a");
        expect(finished.progress.failure).toBeNull();
        expect(yield* entriesOf(fixture, "assignment.created")).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              change: expect.objectContaining({
                person: fixture.people.teacher.personId,
              }),
              subject: expect.objectContaining({ id: eightA.cohortId }),
            }),
          ])
        );
        const rows = yield* snapshot(fixture);
        expect(
          Arr.filter(rows.assignments, (row) => row.periodId === s.target.id)
        ).toMatchObject([{ cohortId: eightA.cohortId, kind: "homeroom" }]);
      })
  );
});

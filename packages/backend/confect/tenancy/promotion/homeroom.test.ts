import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  approvedPromotion,
  assignments,
  cohort,
  createdFor,
  drain,
  entriesOf,
  flipGrants,
  nf,
  people,
  promotion,
  runPromotion,
  scenario,
  snapshot,
  toEightA,
  toEightB,
  toGraduate,
  undoOnce,
} from "@repo/backend/test/promotion";
import { grantRole, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { apply } = promotion.apply;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

/** Fake timers keep every scheduled run from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/promotion homeroom step", () => {
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

  it.effect(
    "stops the homeroom step at a homeroom teacher who no longer holds a teacher grant, and copies nobody",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* flipGrants(
          fixture,
          [fixture.people.teacher.personId],
          "active",
          "revoked"
        );
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: "PersonNotTeacher",
          running: false,
          step: "homeroom",
        });
        expect(finished.copies).toEqual([]);
      })
  );

  it.effect(
    "copies nobody for a homeroom teacher removed while the source period is archived, and the promotion finishes",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const promotionId = yield* approvedPromotion(fixture, s);
        yield* fixture.as("admin").mutation(apply, { promotionId, slug: nf });
        // Only the archive step runs here, so the source period is archived when the teacher leaves.
        yield* fixture.internal.mutation(runPromotion, {
          actorId: fixture.people.admin.personId,
          promotionId,
        });
        yield* fixture.as("admin").mutation(people.remove, {
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const finished = yield* drain(fixture, promotionId);
        expect(finished.progress).toMatchObject({
          failure: null,
          running: false,
        });
        expect(finished.progress.done).toEqual([
          "archive",
          "cohorts",
          "place",
          "homeroom",
        ]);
        expect(finished.copies).toEqual([]);
        const state = yield* snapshot(fixture);
        expect(
          Arr.filter(state.assignments, (row) => row.periodId === s.target.id)
        ).toEqual([]);
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

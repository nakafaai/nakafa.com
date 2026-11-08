import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { IDLE_PROGRESS } from "@repo/backend/confect/tenancy/promotion/progress";
import type { tenantPromotionValidator } from "@repo/backend/confect/tenancy/promotion/schema";
import type { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;
type PeriodId = GenericId.GenericId<"tenantPeriods">;
type CohortId = GenericId.GenericId<"tenantCohorts">;

/** IDs of rows that no hold opens: the store checks only the table an ID names. */
const examId = Schema.decodeUnknownSync(Id("exams"))("1exams");
const classId = Schema.decodeUnknownSync(Id("classes"))("1classes");
const cohortId = Schema.decodeUnknownSync(Id("tenantCohorts"))(
  "1tenantCohorts"
);
const graduationId = Schema.decodeUnknownSync(Id("graduations"))(
  "1graduations"
);
const schemeId = Schema.decodeUnknownSync(Id("gradingSchemes"))(
  "1gradingSchemes"
);

/** One period of the SMP unit and its cohorts, written straight to the store. */
export const term = (
  fixture: Fixture,
  status: "planned" | "archived",
  names: readonly string[]
) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const periodId = yield* writer.table("tenantPeriods").insert({
        end: "2026-12-19",
        name: `Periode ${status}`,
        start: "2026-07-13",
        status,
        tenantId: fixture.tenants.nf,
        unitId: fixture.units.smp,
      });
      const cohorts = yield* Effect.forEach(names, (name) =>
        writer.table("tenantCohorts").insert({
          grade: 7,
          name,
          nameKey: name.toLowerCase(),
          periodId,
          status: "active",
          tenantId: fixture.tenants.nf,
          unitId: fixture.units.smp,
        })
      );
      return { cohorts, periodId };
    }).pipe(Effect.orDie)
  );

/** An applied promotion between two periods, with the cohorts its plan names and the ones it created. */
export const promotionRow = (
  fixture: Fixture,
  from: PeriodId,
  into: PeriodId,
  sources: readonly CohortId[],
  created: readonly CohortId[],
  undoing = false
): typeof tenantPromotionValidator.Type => ({
  copies: [],
  created: Arr.map(created, (id) => ({ cohortId: id, nameKey: "8a" })),
  progress: undoing
    ? { ...IDLE_PROGRESS, direction: "undo", running: true, step: "cohorts" }
    : IDLE_PROGRESS,
  returnReason: null,
  sourcePeriodId: from,
  sources: Arr.map(sources, (id) => ({
    cohortId: id,
    homeroom: false,
    to: { kind: "stay" },
  })),
  state: "applied",
  targetPeriodId: into,
  targets: [],
  tenantId: fixture.tenants.nf,
  unitId: fixture.units.smp,
});

/**
 * Ten cohorts of one period, each pointed at by one kind of record, in this order: a placed student, an active
 * homeroom teacher, a removed one, a class, a sitting, a report card, a letter, a promotion's plan, a promotion that
 * created it, and nothing.
 */
export const heldCohorts = Effect.fn("test.holds.cohorts")(function* (
  fixture: Fixture
) {
  const names = ["7A", "7B", "7C", "7D", "7E", "7F", "7G", "7H", "7I", "7J"];
  const { cohorts, periodId } = yield* term(fixture, "planned", names);
  const next = yield* term(fixture, "planned", []);
  const [members, homeroom, removed, classes, sittings, reports, letters] =
    cohorts;
  const tenantId = fixture.tenants.nf;
  const unitId = fixture.units.smp;
  const personId = fixture.people.student.personId;
  yield* fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("tenantCohortMembers")
        .insert({ cohortId: members, periodId, personId, tenantId });
      yield* writer.table("tenantAssignments").insert({
        cohortId: homeroom,
        kind: "homeroom",
        periodId,
        personId: fixture.people.teacher.personId,
        tenantId,
      });
      const gone = yield* writer.table("tenantPeople").insert({
        account: { state: "unclaimed" },
        kind: "member",
        name: "Guru Lama",
        status: "removed",
        tenantId,
      });
      yield* writer.table("tenantAssignments").insert({
        cohortId: removed,
        kind: "homeroom",
        periodId,
        personId: gone,
        tenantId,
      });
      yield* writer.table("classes").insert({
        cohortId: classes,
        createdAt: 0,
        name: "IPA 7D",
        nameKey: "ipa 7d",
        periodId,
        slug: "ipa-7d",
        status: "archived",
        subjectKey: "",
        tenantId,
        unitId,
        updatedAt: 0,
      });
      yield* writer.table("examSittings").insert({
        closesAt: 2,
        cohortId: sittings,
        examId,
        jobs: [],
        opensAt: 1,
        room: "Ruang 1",
        state: "closed",
        tenantId,
        tokenHash: "hash",
        tokenIssuedAt: 0,
        tokenSealed: new ArrayBuffer(1),
        unitId,
      });
      yield* writer.table("reportCards").insert({
        cohortId: reports,
        createdAt: 0,
        note: "",
        periodId,
        personId,
        state: "draft",
        tenantId,
        updatedAt: 0,
      });
      yield* writer.table("graduationLetters").insert({
        average: 80,
        cohortId: letters,
        graduationId,
        hash: "hash",
        issuedAt: 0,
        issuedBy: personId,
        number: "1",
        periodId,
        personId,
        state: "issued",
        subjects: [],
        tenantId,
        unitId,
      });
      yield* writer
        .table("tenantPromotions")
        .insert(
          promotionRow(fixture, periodId, next.periodId, [cohorts[7]], [])
        );
      yield* writer
        .table("tenantPromotions")
        .insert(
          promotionRow(fixture, next.periodId, periodId, [], [cohorts[8]])
        );
    }).pipe(Effect.orDie)
  );
  return { cohorts, periodId };
});

/**
 * Ten archived periods, each pointed at by one kind of record, in this order: a cohort, a class, a grade, a graduation,
 * a promotion from it, a promotion into it, a standing, a narrative, a draft, and nothing.
 */
export const heldPeriods = Effect.fn("test.holds.periods")(function* (
  fixture: Fixture
) {
  const periods = yield* Effect.forEach(Arr.range(1, 10), () =>
    Effect.map(term(fixture, "archived", []), (period) => period.periodId)
  );
  const other = yield* term(fixture, "archived", []);
  const [cohorts, classes, grades, graduations, from, into] = periods;
  const tenantId = fixture.tenants.nf;
  const unitId = fixture.units.smp;
  const personId = fixture.people.student.personId;
  const authorId = fixture.people.teacher.personId;
  yield* fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      yield* writer.table("tenantCohorts").insert({
        grade: 7,
        name: "7A",
        nameKey: "7a",
        periodId: cohorts,
        status: "archived",
        tenantId,
        unitId,
      });
      yield* writer.table("classes").insert({
        cohortId,
        createdAt: 0,
        name: "IPA 7A",
        nameKey: "ipa 7a",
        periodId: classes,
        slug: "ipa-7a",
        status: "archived",
        subjectKey: "",
        tenantId,
        unitId,
        updatedAt: 0,
      });
      yield* writer.table("classGrades").insert({
        classId,
        createdAt: 0,
        periodId: grades,
        personId,
        schemeId,
        state: "draft",
        tenantId,
        updatedAt: 0,
        value: 80,
      });
      yield* writer.table("graduations").insert({
        createdAt: 0,
        date: "2026-06-01",
        decidedBy: personId,
        decision: "1/2026",
        head: "Kepala",
        issued: 0,
        periodId: graduations,
        place: "Bandung",
        tenantId,
        unitId,
        updatedAt: 0,
      });
      yield* writer
        .table("tenantPromotions")
        .insert(promotionRow(fixture, from, other.periodId, [], []));
      yield* writer
        .table("tenantPromotions")
        .insert(promotionRow(fixture, other.periodId, into, [], []));
      yield* writer.table("insightMastery").insert({
        competency: "Bilangan",
        earned: 1,
        observations: 1,
        periodId: periods[6],
        personId,
        possible: 1,
        rating: 1,
        tenantId,
        updatedAt: 0,
      });
      yield* writer.table("insightNarratives").insert({
        authorId,
        classId,
        periodId: periods[7],
        personId,
        sealedText: new ArrayBuffer(1),
        tenantId,
        updatedAt: 0,
      });
      yield* writer.table("insightDrafts").insert({
        askedBy: authorId,
        classId,
        periodId: periods[8],
        personId,
        tenantId,
        updatedAt: 0,
      });
    }).pipe(Effect.orDie)
  );
  return periods;
});

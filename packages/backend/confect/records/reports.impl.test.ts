import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  classOf,
  cohort,
  denied,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import {
  actedAt,
  grantRole,
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Exit, Struct } from "effect";

/** A report hash: 64 lowercase hex digits. */
const HASH = /^[0-9a-f]{64}$/;

/** A web address, as a stored file's has. */
const WEB_ADDRESS = /^https?:\/\//;

const reports = refs.public.records.reports;
const grades = refs.public.records.grades;
const checks = refs.public.records.checks;
const prints = refs.internal.records.prints;

type Fixture = Effect.Success<typeof tenancyFixture>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * A cohort of the SMP unit with the school's teacher as its homeroom teacher and the
 * subject teacher of its Fisika class, the student placed in it with a released grade,
 * and the principal granted over the unit.
 */
const setup = Effect.fn("test.reports.setup")(function* (fixture: Fixture) {
  const term = yield* period(fixture, fixture.units.smp);
  const x1 = yield* cohort(fixture, term.id, "X-1");
  const fisika = yield* classOf(fixture, x1.id, "Fisika");
  const teacher = fixture.people.teacher.personId;
  const student = fixture.people.student.personId;
  yield* teach(fixture, fisika.id, teacher);
  yield* fixture.as("admin").mutation(refs.public.tenancy.placements.place, {
    cohortId: x1.id,
    personId: student,
    slug: nf,
  });
  yield* fixture.as("admin").mutation(refs.public.tenancy.assignments.assign, {
    cohortId: x1.id,
    personId: teacher,
    slug: nf,
  });
  yield* fixture.run(
    grantRole(
      fixture.tenants.nf,
      fixture.people.principal.personId,
      "principal",
      {
        kind: "unit",
        unitId: fixture.units.smp,
      }
    )
  );
  const grade = yield* fixture.as("teacher").mutation(grades.enter, {
    classId: fisika.id,
    personId: student,
    slug: nf,
    value: 82,
  });
  yield* fixture
    .as("teacher")
    .mutation(grades.release, { gradeId: grade.id, slug: nf });
  return { cohortId: x1.id, student };
});

/** The homeroom teacher writes the note of the student's report. */
const writeNote = (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  personId: GenericId.GenericId<"tenantPeople">,
  note: string
) =>
  fixture
    .as("teacher")
    .mutation(reports.write, { cohortId, note, personId, slug: nf });

/** The stored report card of one ID. */
const reportRow = (
  fixture: Fixture,
  reportId: GenericId.GenericId<"reportCards">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("reportCards").get(reportId).pipe(Effect.orDie)
    )
  );

describe("records/reports", () => {
  it.effect(
    "lets the homeroom teacher write, hand in, and take back a report with the released grades",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, student } = yield* setup(fixture);
        const empty = yield* fixture
          .as("teacher")
          .query(reports.sheet, { ...firstPage, cohortId, slug: nf });
        expect(empty.page).toEqual([
          {
            can: ["report.write"],
            report: null,
            student: { id: student, name: "Student" },
          },
        ]);
        const draft = yield* writeNote(fixture, cohortId, student, "Rajin.");
        expect(draft).toMatchObject({
          approvedAt: null,
          note: "Rajin.",
          state: "draft",
        });
        const again = yield* writeNote(
          fixture,
          cohortId,
          student,
          "Rajin dan teliti."
        );
        expect(again.id).toBe(draft.id);
        const detail = yield* fixture
          .as("principal")
          .query(reports.get, { reportId: draft.id, slug: nf });
        expect(detail).toMatchObject({
          file: null,
          note: "Rajin dan teliti.",
          subjects: [{ className: "Fisika X-1", kktp: "reached", value: 82 }],
        });
        const completed = yield* fixture
          .as("teacher")
          .mutation(reports.complete, { reportId: draft.id, slug: nf });
        expect(completed.state).toBe("completed");
        expect(
          yield* Effect.flip(writeNote(fixture, cohortId, student, "Lagi."))
        ).toMatchObject({ _tag: "ReportClosed" });
        expect(
          yield* Effect.flip(
            fixture
              .as("teacher")
              .mutation(reports.complete, { reportId: draft.id, slug: nf })
          )
        ).toMatchObject({ _tag: "ReportClosed" });
        const reopened = yield* fixture
          .as("teacher")
          .mutation(reports.reopen, { reportId: draft.id, slug: nf });
        expect(reopened.state).toBe("draft");
        expect(yield* reportRow(fixture, draft.id)).not.toHaveProperty(
          "completedAt"
        );
        expect(
          yield* Effect.flip(
            fixture
              .as("teacher")
              .mutation(reports.reopen, { reportId: draft.id, slug: nf })
          )
        ).toMatchObject({ _tag: "ReportClosed" });
        const listed = yield* fixture
          .as("admin")
          .query(reports.sheet, { ...firstPage, cohortId, slug: nf });
        expect(listed.page[0]).toMatchObject({
          can: [],
          report: { id: draft.id, state: "draft" },
        });
        const homeroom = yield* fixture
          .as("teacher")
          .query(reports.sheet, { ...firstPage, cohortId, slug: nf });
        expect(homeroom.page[0]?.can).toEqual([
          "report.complete",
          "report.write",
        ]);
      })
  );

  it.effect(
    "approves a handed-in report, draws its PDF, locks it, and answers its hash to the public check",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, student } = yield* setup(fixture);
        const draft = yield* writeNote(fixture, cohortId, student, "Rajin.");
        yield* fixture
          .as("teacher")
          .mutation(reports.complete, { reportId: draft.id, slug: nf });
        vi.setSystemTime(actedAt());
        const approved = yield* fixture
          .as("principal")
          .mutation(reports.approve, { reportId: draft.id, slug: nf });
        expect(approved.state).toBe("approved");
        expect(
          yield* Effect.flip(
            fixture
              .as("principal")
              .mutation(reports.approve, { reportId: draft.id, slug: nf })
          )
        ).toMatchObject({ _tag: "ReportClosed" });
        yield* fixture.finishScheduled();
        const row = yield* reportRow(fixture, draft.id);
        expect(row).toMatchObject({
          approvedBy: fixture.people.principal.personId,
          state: "locked",
          subjects: [{ className: "Fisika X-1", kktp: "reached", value: 82 }],
        });
        expect(row.hash).toMatch(HASH);
        const locked = yield* fixture
          .as("teacher")
          .query(reports.get, { reportId: draft.id, slug: nf });
        expect(locked.file).toMatch(WEB_ADDRESS);
        const entry = Arr.last(yield* fixture.run(journal));
        expect(entry).toMatchObject({
          _tag: "Some",
          value: {
            change: { hash: row.hash, type: "report.locked" },
            subject: { id: draft.id, kind: "report" },
          },
        });
        expect(
          yield* fixture.anonymous.mutation(checks.report, {
            hash: row.hash ?? "",
          })
        ).toEqual({
          approvedAt: actedAt(),
          kind: "report",
          outcome: "locked",
          period: "Ganjil 2026/2027",
          school: "Yayasan Nakafa",
        });
        expect(
          yield* fixture.anonymous.mutation(checks.report, {
            hash: "0".repeat(64),
          })
        ).toEqual({ outcome: "unknown" });
      })
  );

  it.effect(
    "puts the cohort's released grades on a report in the order of the class names, each judged by its own scheme, and no grade of another cohort's class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, student } = yield* setup(fixture);
        yield* fixture.as("admin").mutation(refs.public.records.schemes.store, {
          bands: [{ label: "Baik", minimum: 80 }],
          effectiveFrom: TENANCY_NOW,
          kktp: 75,
          slug: nf,
        });
        const biologi = yield* classOf(fixture, cohortId, "Biologi");
        yield* teach(fixture, biologi.id, fixture.people.teacher.personId);
        const grade = yield* fixture.as("teacher").mutation(grades.enter, {
          classId: biologi.id,
          personId: student,
          slug: nf,
          value: 90,
        });
        yield* fixture
          .as("teacher")
          .mutation(grades.release, { gradeId: grade.id, slug: nf });
        const { periodId } = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantCohorts").get(cohortId).pipe(Effect.orDie)
          )
        );
        const x2 = yield* cohort(fixture, periodId, "X-2");
        const kimia = yield* classOf(fixture, x2.id, "Kimia");
        // A grade the student kept from a class of the cohort they left.
        yield* fixture.run(
          Effect.gen(function* () {
            const released = yield* (yield* DatabaseReader)
              .table("classGrades")
              .get(grade.id)
              .pipe(Effect.orDie);
            yield* (yield* DatabaseWriter)
              .table("classGrades")
              .insert(
                Struct.assign(Struct.omit(released, ["_creationTime", "_id"]), {
                  classId: kimia.id,
                })
              )
              .pipe(Effect.orDie);
          })
        );
        const draft = yield* writeNote(fixture, cohortId, student, "Rajin.");
        const detail = yield* fixture
          .as("teacher")
          .query(reports.get, { reportId: draft.id, slug: nf });
        expect(detail.subjects).toEqual([
          {
            band: "Baik",
            className: "Biologi X-1",
            kktp: "reached",
            value: 90,
          },
          { className: "Fisika X-1", kktp: "reached", value: 82 },
        ]);
      })
  );

  it.effect("draws no print of a report that is not approved", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { cohortId, student } = yield* setup(fixture);
      const draft = yield* writeNote(fixture, cohortId, student, "Rajin.");
      const exit = yield* Effect.exit(
        fixture.internal.query(prints.printable, { reportId: draft.id })
      );
      expect(Exit.hasDies(exit)).toBe(true);
    })
  );

  it.effect(
    "keeps the writes to the homeroom teacher and the approval to the principal, for placed students only",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, student } = yield* setup(fixture);
        expect(
          yield* Effect.flip(
            fixture.as("counselor").mutation(reports.write, {
              cohortId,
              note: "Rajin.",
              personId: student,
              slug: nf,
            })
          )
        ).toMatchObject({ _tag: "AccessDenied" });
        expect(
          yield* Effect.flip(
            writeNote(fixture, cohortId, fixture.invited, "Rajin.")
          )
        ).toMatchObject({ _tag: "ReportNotPlaced" });
        const draft = yield* writeNote(fixture, cohortId, student, "Rajin.");
        yield* fixture
          .as("teacher")
          .mutation(reports.complete, { reportId: draft.id, slug: nf });
        for (const account of ["teacher", "deputy"] as const) {
          expect(
            yield* Effect.flip(
              fixture
                .as(account)
                .mutation(reports.approve, { reportId: draft.id, slug: nf })
            )
          ).toMatchObject(denied("role"));
        }
        for (const account of ["student", "counselor"] as const) {
          expect(
            yield* Effect.flip(
              fixture
                .as(account)
                .query(reports.get, { reportId: draft.id, slug: nf })
            )
          ).toMatchObject({ _tag: "AccessDenied" });
        }
      })
  );

  it.effect(
    "answers unknown to every check past the limit, a locked hash included",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, student } = yield* setup(fixture);
        const draft = yield* writeNote(fixture, cohortId, student, "Rajin.");
        yield* fixture
          .as("teacher")
          .mutation(reports.complete, { reportId: draft.id, slug: nf });
        yield* fixture
          .as("principal")
          .mutation(reports.approve, { reportId: draft.id, slug: nf });
        const approved = yield* reportRow(fixture, draft.id);
        const hash = approved.hash ?? "";
        expect(
          yield* fixture.anonymous.mutation(checks.report, { hash })
        ).toEqual({ outcome: "unknown" });
        yield* fixture.finishScheduled();
        for (const _ of Arr.makeBy(299, (index) => index)) {
          yield* fixture.anonymous.mutation(checks.report, { hash });
        }
        expect(
          yield* fixture.anonymous.mutation(checks.report, { hash })
        ).toEqual({ outcome: "unknown" });
      })
  );

  it.effect(
    "lists the class groups whose reports the viewer opens: the homeroom teacher's and the principal's",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId } = yield* setup(fixture);
        yield* fixture.as("admin").mutation(refs.public.tenancy.periods.open, {
          periodId: (yield* fixture.run(
            Effect.flatMap(DatabaseReader, (reader) =>
              reader.table("tenantCohorts").get(cohortId).pipe(Effect.orDie)
            )
          )).periodId,
          slug: nf,
        });
        const expected = [
          { id: cohortId, name: "X-1", period: "Ganjil 2026/2027" },
        ];
        for (const account of ["teacher", "principal", "admin"] as const) {
          expect(
            yield* fixture.as(account).query(reports.cohorts, { slug: nf })
          ).toEqual(expected);
        }
        expect(
          yield* fixture.as("counselor").query(reports.cohorts, { slug: nf })
        ).toEqual([]);
      })
  );
});

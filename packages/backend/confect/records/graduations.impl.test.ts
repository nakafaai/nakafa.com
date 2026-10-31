import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  classOf,
  denied,
  firstPage,
  nf,
  openPeriod,
  period,
  sdUnit,
  teach,
} from "@repo/backend/test/classroom";
import { asStaffSchool, NISN } from "@repo/backend/test/guardians";
import {
  cohortOf,
  complete,
  lockReport,
  release,
  staff,
} from "@repo/backend/test/records";
import {
  grantRole,
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Exit, Option } from "effect";

const graduations = refs.public.records.graduations;
const checks = refs.public.records.checks;
const letters = refs.internal.records.letters;

/** A web address, as a stored file's has. */
const WEB_ADDRESS = /^https?:\/\//;

/** The decision on graduation the principal records in the tests. */
const DECISION = {
  date: "2027-06-07",
  decision: "421.3/045/SMP.1/2027",
  head: "Dra. Siti Aminah, M.Pd.",
  place: "Bandung",
};

type Fixture = Effect.Success<typeof tenancyFixture>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * An SMP class group of the last grade, IX-A, in an open period, with the student placed in it,
 * Matematika at 80 and Bahasa Indonesia at 91 released, and the student's report locked. The
 * school holds its key and the counselor is Staff too.
 */
const setup = Effect.fn("test.graduations.setup")(function* (fixture: Fixture) {
  yield* asStaffSchool(fixture);
  const term = yield* period(fixture, fixture.units.smp);
  const ix = yield* cohortOf(fixture, term.id, "IX-A", 9);
  yield* staff(fixture, ix.id, fixture.units.smp);
  for (const [subject, value] of [
    ["Matematika", 80],
    ["Bahasa Indonesia", 91],
  ] as const) {
    const cls = yield* classOf(fixture, ix.id, subject);
    yield* teach(fixture, cls.id, fixture.people.teacher.personId);
    yield* release(fixture, cls.id, value);
  }
  yield* lockReport(fixture, ix.id);
  return { cohortId: ix.id, periodId: term.id };
});

describe("records/graduations", () => {
  it.effect(
    "lists what is missing, issues the SKL once nothing is, locks it with its PDF, and answers its hash",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, periodId } = yield* setup(fixture);
        const args = { cohortId, slug: nf };
        const overview = yield* fixture
          .as("principal")
          .query(graduations.get, args);
        expect(overview).toEqual({
          can: ["graduation.decide", "graduation.issue"],
          cohort: {
            id: cohortId,
            name: "IX-A",
            period: "Ganjil 2026/2027",
            periodId,
          },
          decision: null,
          suggested: "2026-06-01",
          unit: { name: "SMP Nakafa", npsn: null },
        });
        expect(
          (yield* fixture.as("admin").query(graduations.get, args)).can
        ).toEqual([]);
        const before = yield* fixture
          .as("principal")
          .query(graduations.sheet, { ...firstPage, ...args });
        expect(before.page).toEqual([
          {
            hasNisn: false,
            letter: null,
            missing: ["npsn", "decision", "nisn"],
            student: { id: fixture.people.student.personId, name: "Student" },
            transcript: {
              average: 85.5,
              subjects: [
                { subject: "Bahasa Indonesia", value: 91 },
                { subject: "Matematika", value: 80 },
              ],
            },
          },
        ]);
        expect(
          yield* Effect.flip(
            fixture
              .as("principal")
              .mutation(graduations.issue, { ...args, cursor: null })
          )
        ).toMatchObject({ _tag: "GraduationUndecided" });
        expect(
          yield* Effect.flip(
            fixture.as("principal").mutation(graduations.decide, {
              ...DECISION,
              date: "2027-02-30",
              periodId,
              slug: nf,
            })
          )
        ).toMatchObject({ _tag: "GraduationDateInvalid" });
        const decided = yield* fixture
          .as("principal")
          .mutation(graduations.decide, { ...DECISION, periodId, slug: nf });
        expect(decided).toEqual({ ...DECISION, issued: 0 });
        expect(Arr.last(yield* fixture.run(journal))).toMatchObject({
          _tag: "Some",
          value: {
            change: { type: "graduation.decided" },
            subject: { id: periodId, kind: "period" },
          },
        });
        expect(
          yield* fixture
            .as("principal")
            .mutation(graduations.issue, { ...args, cursor: null })
        ).toMatchObject({ isDone: true, issued: 0, skipped: 1 });
        yield* complete(fixture);
        const withNip = yield* fixture
          .as("principal")
          .mutation(graduations.decide, {
            ...DECISION,
            nip: "196501011990032001",
            periodId,
            slug: nf,
          });
        expect(withNip.nip).toBe("196501011990032001");
        const issued = yield* fixture
          .as("principal")
          .mutation(graduations.issue, { ...args, cursor: null });
        expect(issued).toMatchObject({ isDone: true, issued: 1, skipped: 0 });
        const drawing = yield* fixture
          .as("principal")
          .query(graduations.sheet, { ...firstPage, ...args });
        expect(drawing.page[0]?.letter).toMatchObject({
          file: null,
          state: "issued",
        });
        yield* fixture.finishScheduled();
        const after = yield* fixture
          .as("admin")
          .query(graduations.sheet, { ...firstPage, ...args });
        const line = after.page[0];
        expect(line).toMatchObject({
          hasNisn: true,
          letter: { number: `${DECISION.decision}/001`, state: "locked" },
          missing: [],
        });
        expect(line?.letter?.file).toMatch(WEB_ADDRESS);
        const hash = line?.letter?.hash ?? "";
        expect(Arr.last(yield* fixture.run(journal))).toMatchObject({
          _tag: "Some",
          value: {
            change: { hash, letter: line?.letter?.id, type: "letter.locked" },
            subject: { id: cohortId, kind: "cohort" },
          },
        });
        expect(
          yield* fixture.anonymous.mutation(checks.report, { hash })
        ).toEqual({
          approvedAt: TENANCY_NOW,
          kind: "letter",
          outcome: "locked",
          period: "Ganjil 2026/2027",
          school: "SMP Nakafa",
        });
        expect(
          yield* Effect.flip(
            fixture
              .as("principal")
              .mutation(graduations.decide, { ...DECISION, periodId, slug: nf })
          )
        ).toMatchObject({ _tag: "GraduationIssued" });
        expect(
          yield* fixture
            .as("principal")
            .mutation(graduations.issue, { ...args, cursor: null })
        ).toMatchObject({ issued: 0, skipped: 0 });
        const readiness = yield* fixture
          .as("counselor")
          .query(graduations.readiness, { ...firstPage, ...args });
        expect(readiness.page[0]).toMatchObject({ missing: [], nisn: NISN });
        expect(
          (yield* fixture.as("principal").query(graduations.get, args)).decision
        ).toMatchObject({ issued: 1 });
        // A locked letter is printed once; another print of it is a defect.
        expect(
          Exit.hasDies(
            yield* Effect.exit(
              fixture.internal.query(letters.printable, {
                letterId: Option.getOrThrow(
                  Option.fromUndefinedOr(line?.letter?.id)
                ),
              })
            )
          )
        ).toBe(true);
      })
  );

  it.effect(
    "keeps the pages to the principal, the Admin, and Staff, and the decision and the issue to the principal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, periodId } = yield* setup(fixture);
        const args = { cohortId, slug: nf };
        expect(
          yield* Effect.flip(fixture.as("teacher").query(graduations.get, args))
        ).toMatchObject(denied("role"));
        expect(
          yield* Effect.flip(
            fixture
              .as("teacher")
              .query(graduations.readiness, { ...firstPage, ...args })
          )
        ).toMatchObject(denied("role"));
        expect(
          yield* Effect.flip(
            fixture
              .as("admin")
              .mutation(graduations.decide, { ...DECISION, periodId, slug: nf })
          )
        ).toMatchObject(denied("role"));
        expect(
          yield* Effect.flip(
            fixture
              .as("counselor")
              .mutation(graduations.issue, { ...args, cursor: null })
          )
        ).toMatchObject(denied("role"));
        yield* openPeriod(fixture, periodId);
        const listed = [
          {
            id: cohortId,
            name: "IX-A",
            period: "Ganjil 2026/2027",
            unit: "SMP Nakafa",
          },
        ];
        for (const account of ["principal", "admin", "counselor"] as const) {
          expect(
            yield* fixture.as(account).query(graduations.cohorts, { slug: nf })
          ).toEqual(listed);
        }
        expect(
          yield* fixture.as("teacher").query(graduations.cohorts, { slug: nf })
        ).toEqual([]);
      })
  );

  it.effect(
    "refuses a class group outside the last grade, and a decision for a unit without one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, periodId } = yield* setup(fixture);
        const viii = yield* cohortOf(fixture, periodId, "VIII-A", 8);
        yield* openPeriod(fixture, periodId);
        const args = { cohortId: viii.id, slug: nf };
        expect(
          yield* Effect.flip(
            fixture.as("principal").query(graduations.get, args)
          )
        ).toMatchObject({ _tag: "GraduationNotFinal" });
        expect(
          yield* Effect.flip(
            fixture
              .as("principal")
              .query(graduations.sheet, { ...firstPage, ...args })
          )
        ).toMatchObject({ _tag: "GraduationNotFinal" });
        expect(
          yield* Effect.flip(
            fixture
              .as("principal")
              .mutation(graduations.issue, { ...args, cursor: null })
          )
        ).toMatchObject({ _tag: "GraduationNotFinal" });
        const other = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantUnits").insert({
              contentLanguage: "id",
              level: "other",
              name: "Kursus Nakafa",
              status: "active",
              tenantId: fixture.tenants.nf,
              timeZone: "Asia/Jakarta",
            })
          ).pipe(Effect.orDie)
        );
        const course = yield* period(fixture, other);
        yield* openPeriod(fixture, course.id);
        yield* cohortOf(fixture, course.id, "Kelas 9", 9);
        expect(
          yield* Effect.flip(
            fixture.as("owner").mutation(graduations.decide, {
              ...DECISION,
              periodId: course.id,
              slug: nf,
            })
          )
        ).toMatchObject({ _tag: "GraduationNotFinal" });
        expect(
          yield* fixture.as("owner").query(graduations.cohorts, { slug: nf })
        ).toEqual([
          {
            id: cohortId,
            name: "IX-A",
            period: "Ganjil 2026/2027",
            unit: "SMP Nakafa",
          },
        ]);
      })
  );

  it.effect(
    "lists a student without a locked report card or a roster row as missing both, with no transcript",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const ix = yield* cohortOf(fixture, term.id, "IX-B", 9);
        yield* staff(fixture, ix.id, fixture.units.smp);
        const args = { ...firstPage, cohortId: ix.id, slug: nf };
        const readiness = yield* fixture
          .as("admin")
          .query(graduations.readiness, args);
        expect(readiness.page).toEqual([
          {
            hasNisn: false,
            letter: null,
            missing: ["npsn", "decision", "nisn", "report"],
            nisn: null,
            student: { id: fixture.people.student.personId, name: "Student" },
            transcript: null,
          },
        ]);
      })
  );

  it.effect(
    "counts a homeroom class's grades under its class name on an SD transcript",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const sd = yield* sdUnit(fixture);
        for (const [account, role] of [
          ["student", "student"],
          ["teacher", "teacher"],
        ] as const) {
          yield* fixture.run(
            grantRole(
              fixture.tenants.nf,
              fixture.people[account].personId,
              role,
              {
                kind: "unit",
                unitId: sd,
              }
            )
          );
        }
        const term = yield* period(fixture, sd);
        const vi = yield* cohortOf(fixture, term.id, "VI-A", 6);
        yield* staff(fixture, vi.id, sd);
        const homeroom = yield* classOf(fixture, vi.id);
        yield* teach(fixture, homeroom.id, fixture.people.teacher.personId);
        yield* release(fixture, homeroom.id, 88);
        yield* lockReport(fixture, vi.id);
        const sheet = yield* fixture.as("principal").query(graduations.sheet, {
          ...firstPage,
          cohortId: vi.id,
          slug: nf,
        });
        expect(sheet.page[0]?.transcript).toEqual({
          average: 88,
          subjects: [{ subject: "VI-A", value: 88 }],
        });
      })
  );
});

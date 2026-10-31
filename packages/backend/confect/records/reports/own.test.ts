import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  classOf,
  cohort,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import {
  actedAt,
  grantRole,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

/** A report hash: 64 lowercase hex digits. */
const HASH = /^[0-9a-f]{64}$/;

/** A web address, as a stored file's has. */
const WEB_ADDRESS = /^https?:\/\//;

const reports = refs.public.records.reports;
const grades = refs.public.records.grades;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("records/reports own", () => {
  it.effect(
    "lists a student's report card once it is locked, with its class group, period, PDF and hash, and only to that student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const teacher = fixture.people.teacher.personId;
        const student = fixture.people.student.personId;
        yield* teach(fixture, fisika.id, teacher);
        yield* fixture
          .as("admin")
          .mutation(refs.public.tenancy.placements.place, {
            cohortId: x1.id,
            personId: student,
            slug: nf,
          });
        yield* fixture
          .as("admin")
          .mutation(refs.public.tenancy.assignments.assign, {
            cohortId: x1.id,
            personId: teacher,
            slug: nf,
          });
        yield* fixture.run(
          grantRole(
            fixture.tenants.nf,
            fixture.people.principal.personId,
            "principal",
            { kind: "unit", unitId: fixture.units.smp }
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
        const draft = yield* fixture.as("teacher").mutation(reports.write, {
          cohortId: x1.id,
          note: "Rajin.",
          personId: student,
          slug: nf,
        });
        yield* fixture
          .as("teacher")
          .mutation(reports.complete, { reportId: draft.id, slug: nf });
        // The approval runs at an instant of its own, after the setup's commits.
        vi.setSystemTime(actedAt());
        yield* fixture
          .as("principal")
          .mutation(reports.approve, { reportId: draft.id, slug: nf });
        // Approved and not yet locked, the card stays with the school.
        expect(
          yield* fixture.as("student").query(reports.own, { slug: nf })
        ).toEqual([]);
        yield* fixture.finishScheduled();
        const [card, ...rest] = yield* fixture
          .as("student")
          .query(reports.own, { slug: nf });
        expect(rest).toEqual([]);
        expect(card).toMatchObject({
          approvedAt: actedAt(),
          cohort: "X-1",
          id: draft.id,
          period: "Ganjil 2026/2027",
        });
        expect(card?.hash).toMatch(HASH);
        expect(card?.file).toMatch(WEB_ADDRESS);
        expect(
          yield* fixture.as("teacher").query(reports.own, { slug: nf })
        ).toEqual([]);
      })
  );
});

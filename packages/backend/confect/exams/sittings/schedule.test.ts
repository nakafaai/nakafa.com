import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { teacherExam } from "@repo/backend/test/exams";
import {
  CLOSES_AT,
  keyedExam,
  keyedSchool,
  mentions,
  OPENS_AT,
  scheduleSitting,
  sittingRow,
} from "@repo/backend/test/sittings";
import {
  journal,
  scheduledJobs,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

/** A token: six characters of the alphabet, with no I, O, 0, or 1 (ADR 0013). */
const TOKEN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/u;

describe("exams/sittings schedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "schedules a unit sitting, returns its token once, and keeps only the token's hash",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        expect(made.token).toMatch(TOKEN);
        const row = yield* sittingRow(fixture, made.id);
        expect(row).toMatchObject({
          closesAt: CLOSES_AT,
          cohortId: null,
          examId,
          opensAt: OPENS_AT,
          room: "Lab 2",
          state: "scheduled",
          unitId: fixture.units.smp,
        });
        expect(row.tokenHash).not.toBe(made.token);
        expect(row.tokenHash).not.toContain(made.token);
        expect(row.jobs).toHaveLength(2);
        const entries = yield* fixture.run(journal);
        expect(Arr.map(entries, (entry) => entry.change)).toContainEqual({
          type: "sitting.schedule",
        });
        expect(mentions(yield* fixture.run(scheduledJobs), made.token)).toBe(
          false
        );
      })
  );

  it.effect(
    "refuses a schedule whose opening is not before its closing, as invalid",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const failure = yield* scheduleSitting(fixture, {
          closesAt: OPENS_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "ScheduleInvalid" });
      })
  );

  it.effect(
    "refuses a schedule of an exam with a question that has no fitting key, and names its number",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const exam = yield* teacherExam(fixture, "Tanpa kunci");
        const failure = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId: exam.id,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "KeysMissing", questions: [1] });
      })
  );

  it.effect(
    "schedules a cohort sitting in the cohort's unit, and refuses a cohort of another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const foreignCohort = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const periodId = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Ganjil",
              start: "2026-07-13",
              status: "active",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
            return yield* writer.table("tenantCohorts").insert({
              grade: 1,
              name: "1A",
              nameKey: "1a",
              periodId,
              status: "active",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
          })
        );
        const foreign = yield* scheduleSitting(fixture, {
          actor: "admin",
          closesAt: CLOSES_AT,
          examId,
          group: { cohortId: foreignCohort, kind: "cohort" },
          opensAt: OPENS_AT,
        }).pipe(Effect.flip);
        expect(foreign).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
      })
  );

  it.effect(
    "refuses a sitting in an archived unit to an Admin, as a locked write",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const archived = yield* scheduleSitting(fixture, {
          actor: "admin",
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smk },
          opensAt: OPENS_AT,
        }).pipe(Effect.flip);
        expect(archived).toMatchObject({
          _tag: "AccessDenied",
          reason: "condition",
        });
      })
  );

  it.effect(
    "refuses a teacher who holds no grant over the sitting's unit, by role",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const otherUnit = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.sma },
          opensAt: OPENS_AT,
        }).pipe(Effect.flip);
        expect(otherUnit).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
      })
  );

  it.effect(
    "refuses a schedule to a student, who holds no edit right over the exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const byStudent = yield* scheduleSitting(fixture, {
          actor: "student",
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        }).pipe(Effect.flip);
        expect(byStudent).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
      })
  );
});

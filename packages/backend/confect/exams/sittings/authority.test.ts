import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { ReasonCode } from "@repo/backend/confect/exams/sittings/schema";
import { nf } from "@repo/backend/test/editor";
import {
  admittedOf,
  attemptRow,
  CLOSES_AT,
  deviceOf,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedAttempt,
} from "@repo/backend/test/sittings";
import {
  grantRole,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { enter, lock, dashboard, close } = refs.public.exams.sittings;

/** The reason of the proctor's locks in these tests: one of the six codes. */
const RULE_BREAK: typeof ReasonCode.Type = "rule-break";

/** The student's entry with the sitting's token, which must admit the student. */
const enterStudent = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  token: string
) =>
  fixture
    .as("student")
    .mutation(enter, {
      deviceId: deviceOf(1),
      sittingId,
      slug: nf,
      token,
    })
    .pipe(Effect.flatMap(admittedOf));

/** The arguments of a proctor's lock on one attempt. */
const lockArgs = (
  attemptId: GenericId.GenericId<"examAttempts">,
  sittingId: GenericId.GenericId<"examSittings">
) => ({
  attemptId,
  reason: RULE_BREAK,
  sittingId,
  slug: nf,
});

/** The arguments of one page of a dashboard. */
const pageArgs = (sittingId: GenericId.GenericId<"examSittings">) => ({
  paginationOpts: { cursor: null, numItems: 10 },
  sittingId,
  slug: nf,
});

describe("exams/sittings authority", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "locks a cohort sitting once its period is archived, so a proctor's write is refused as a locked subject",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Kelas Arsip");
        const { cohortId, periodId } = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const period = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Ganjil",
              start: "2026-07-13",
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
            });
            const cohort = yield* writer.table("tenantCohorts").insert({
              grade: 10,
              name: "10A",
              nameKey: "10a",
              periodId: period,
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
            });
            return { cohortId: cohort, periodId: period };
          })
        );
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { cohortId, kind: "cohort" },
          opensAt: OPENS_AT,
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantPeriods")
              .patch(periodId, { status: "archived" })
          )
        );
        const refused = yield* fixture
          .as("teacher")
          .mutation(close, { sittingId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AccessDenied",
          reason: "condition",
        });
      })
  );

  it.effect(
    "refuses a proctor action to a student, a principal, and a counselor, by role",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        const byStudent = yield* fixture
          .as("student")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(byStudent).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
        const byPrincipal = yield* fixture
          .as("principal")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(byPrincipal).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
        const byCounselor = yield* fixture
          .as("counselor")
          .query(dashboard, pageArgs(made.id))
          .pipe(Effect.flip);
        expect(byCounselor).toMatchObject({
          _tag: "AccessDenied",
          reason: "role",
        });
      })
  );

  it.effect(
    "lets the Admin proctor the sitting, and the deputy view its dashboard",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        yield* fixture
          .as("admin")
          .mutation(lock, lockArgs(entered.attempt, made.id));
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "locked",
        });
        const page = yield* fixture
          .as("deputy")
          .query(dashboard, pageArgs(made.id));
        expect(page.attempts.page).toHaveLength(1);
      })
  );

  it.effect(
    "refuses a proctor action on an attempt that is not in the sitting it names, as a missing object",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examAttempts").delete(entered.attempt)
          )
        );
        const missing = yield* fixture
          .as("teacher")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(missing).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
      })
  );

  it.effect(
    "refuses a proctor action on an attempt of another sitting, as a missing object, and leaves that attempt as it was",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const sittingA = yield* openedSitting(fixture, "PTS");
        const examId = yield* keyedExam(fixture, "PAS");
        const sittingB = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const attemptId = yield* seedAttempt(fixture, {
          deadline: CLOSES_AT,
          deviceId: deviceOf(1),
          person: fixture.people.student.personId,
          sittingId: sittingB.id,
          state: "inProgress",
        });
        const refused = yield* fixture
          .as("teacher")
          .mutation(lock, lockArgs(attemptId, sittingA.id))
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AccessDenied",
          reason: "resource",
        });
        expect(yield* attemptRow(fixture, attemptId)).toMatchObject({
          state: "inProgress",
        });
      })
  );

  it.effect(
    "refuses an entry from a member of another school who holds a student grant, as not in the sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* fixture.run(
          grantRole(
            fixture.tenants.other,
            fixture.people.otherOwner.personId,
            "student",
            { kind: "tenant" }
          )
        );
        const refused = yield* fixture
          .as("otherOwner")
          .mutation(enter, {
            deviceId: deviceOf(1),
            sittingId: made.id,
            slug: slugOf("other"),
            token: made.token,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect(
    "refuses a proctor action on a closed sitting, as a write that is locked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterStudent(fixture, made.id, made.token);
        yield* fixture
          .as("teacher")
          .mutation(close, { sittingId: made.id, slug: nf });
        const locked = yield* fixture
          .as("teacher")
          .mutation(lock, lockArgs(entered.attempt, made.id))
          .pipe(Effect.flip);
        expect(locked).toMatchObject({
          _tag: "AccessDenied",
          reason: "condition",
        });
      })
  );
});

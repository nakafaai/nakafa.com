import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { SCHOOL_FREE_STUDENTS } from "@repo/backend/confect/billing/catalog";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { nf } from "@repo/backend/test/editor";
import { archiveUnit } from "@repo/backend/test/exams";
import {
  CLOSES_AT,
  deviceOf,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedPlacement,
} from "@repo/backend/test/sittings";
import {
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const { join } = refs.public.exams.joins;
const { changeToken, enter, expected } = refs.public.exams.sittings;
const open = refs.internal.exams.sittings.timers.open;

/** An account that no school has invited, signed in with a personal Google address. */
const newcomer = (fixture: SittingFixture, suffix: string) =>
  fixture.account(suffix, `${suffix}@gmail.example.test`, true, null);

/** The Person that an account holds in the test school, with its active grants. */
const personOf = (
  fixture: SittingFixture,
  userId: GenericId.GenericId<"users">
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const person = yield* reader
        .table("tenantPeople")
        .index("by_tenantId_and_account_userId", (query) =>
          query.eq("tenantId", fixture.tenants.nf).eq("account.userId", userId)
        )
        .first();
      const grants = yield* Effect.forEach(Arr.fromOption(person), (found) =>
        reader
          .table("tenantGrants")
          .index("by_personId_and_status", (query) =>
            query.eq("personId", found._id).eq("status", "active")
          )
          .collect()
      );
      return { grants: Arr.flatten(grants), person: Option.getOrNull(person) };
    })
  );

/** A member Person of the test school claimed by the account, holding the given student units. */
const seedMember = (
  fixture: SittingFixture,
  userId: GenericId.GenericId<"users">,
  units: readonly GenericId.GenericId<"tenantUnits">[]
) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const personId = yield* writer.table("tenantPeople").insert({
        account: {
          claimedAt: TENANCY_NOW,
          method: "invite",
          state: "claimed",
          userId,
        },
        kind: "member",
        name: "Siswa Lain",
        status: "active",
        tenantId: fixture.tenants.nf,
      });
      yield* Effect.forEach(units, (unitId) =>
        writer.table("tenantGrants").insert({
          grantedBy: { kind: "system" },
          personId,
          role: { key: "student", kind: "builtin" },
          scope: { kind: "unit", unitId },
          status: "active",
          tenantId: fixture.tenants.nf,
          term: { kind: "standing" },
        })
      );
      return personId;
    })
  );

/** Fills the free plan's student seats of the test school, which holds one student already. */
const fillSeats = (fixture: SittingFixture) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      yield* Effect.forEach(Arr.range(2, SCHOOL_FREE_STUDENTS), (n) =>
        writer
          .table("tenantPeople")
          .insert({
            account: { state: "unclaimed" },
            kind: "member",
            name: `Siswa ${n}`,
            status: "active",
            tenantId: fixture.tenants.nf,
          })
          .pipe(
            Effect.flatMap((personId) =>
              writer.table("tenantGrants").insert({
                grantedBy: { kind: "system" },
                personId,
                role: { key: "student", kind: "builtin" },
                scope: { kind: "unit", unitId: fixture.units.smp },
                status: "active",
                tenantId: fixture.tenants.nf,
                term: { kind: "standing" },
              })
            )
          )
      );
    })
  );

describe("exams/joins join", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "makes a newcomer who scanned the room's code a student of its unit, whom the proctor expects and who then enters",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const account = yield* newcomer(fixture, "scan");
        const reply = yield* account.client.mutation(join, {
          sittingId: made.id,
          slug: nf,
          token: ` ${made.token.toLowerCase()} `,
        });
        expect(reply).toEqual({ outcome: "joined", sittingId: made.id });

        const { grants, person } = yield* personOf(fixture, account.userId);
        expect(person).toMatchObject({
          account: { method: "room", state: "claimed" },
          kind: "member",
          status: "active",
        });
        expect(grants).toMatchObject([
          {
            role: { key: "student" },
            scope: { kind: "unit", unitId: fixture.units.smp },
          },
        ]);
        const entries = yield* fixture.run(journal);
        expect(entries).toContainEqual(
          expect.objectContaining({
            change: expect.objectContaining({ method: "room" }),
          })
        );
        expect(entries).toContainEqual(
          expect.objectContaining({
            change: expect.objectContaining({ type: "sitting.join" }),
          })
        );
        const seats = yield* fixture.as("teacher").query(expected, {
          paginationOpts: { cursor: null, numItems: 10 },
          sittingId: made.id,
          slug: nf,
        });
        expect(Arr.map(seats.page, (seat) => seat.name)).toContain("User scan");

        const entered = yield* account.client.mutation(enter, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          slug: nf,
          token: made.token,
        });
        expect(entered).toMatchObject({ outcome: "admitted" });
      })
  );

  it.effect(
    "finds the open room of a code typed alone, and asks a signed-out caller to sign in",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const account = yield* newcomer(fixture, "typed");
        const reply = yield* account.client.mutation(join, {
          slug: nf,
          token: made.token,
        });
        expect(reply).toEqual({ outcome: "joined", sittingId: made.id });
        const anonymous = yield* fixture.anonymous
          .mutation(join, { slug: nf, token: made.token })
          .pipe(Effect.flip);
        expect(anonymous).toMatchObject({ _tag: "SessionRequired" });
        const elsewhere = yield* account.client.mutation(join, {
          slug: slugOf("tidak-ada"),
          token: made.token,
        });
        expect(elsewhere).toEqual({
          outcome: "refused",
          reason: "NotAdmitted",
        });
      })
  );

  it.effect(
    "refuses a code the proctor has changed, and stops a run of wrong codes before the right one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const changed = yield* fixture
          .as("teacher")
          .mutation(changeToken, { sittingId: made.id, slug: nf });
        const account = yield* newcomer(fixture, "guess");
        const old = yield* account.client.mutation(join, {
          sittingId: made.id,
          slug: nf,
          token: made.token,
        });
        expect(old).toEqual({ outcome: "refused", reason: "TokenRefused" });
        yield* Effect.forEach(Arr.range(1, 4), () =>
          account.client.mutation(join, { slug: nf, token: "ZZZZZZ" })
        );
        const stopped = yield* account.client.mutation(join, {
          sittingId: made.id,
          slug: nf,
          token: changed.token,
        });
        expect(stopped).toEqual({ outcome: "refused", reason: "TooManyTries" });
        const { person } = yield* personOf(fixture, account.userId);
        expect(person).toBeNull();
      })
  );

  it.effect(
    "refuses a room before it opens and once its unit is archived",
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
        const account = yield* newcomer(fixture, "early");
        const scanned = { sittingId: made.id, slug: nf, token: made.token };
        expect(yield* account.client.mutation(join, scanned)).toEqual({
          outcome: "refused",
          reason: "SittingNotOpen",
        });
        vi.setSystemTime(OPENS_AT);
        yield* fixture.internal.mutation(open, { sittingId: made.id });
        yield* fixture.run(archiveUnit(fixture.units.smp));
        expect(yield* account.client.mutation(join, scanned)).toEqual({
          outcome: "refused",
          reason: "SittingNotOpen",
        });
      })
  );

  it.effect(
    "refuses a newcomer and a member with no role once the free plan has no seat left, and writes no Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* fillSeats(fixture);
        const scanned = { sittingId: made.id, slug: nf, token: made.token };
        const account = yield* newcomer(fixture, "full");
        expect(yield* account.client.mutation(join, scanned)).toEqual({
          outcome: "refused",
          reason: "SeatLimit",
        });
        expect((yield* personOf(fixture, account.userId)).person).toBeNull();
        const roleless = yield* newcomer(fixture, "roleless");
        yield* seedMember(fixture, roleless.userId, []);
        expect(yield* roleless.client.mutation(join, scanned)).toEqual({
          outcome: "refused",
          reason: "SeatLimit",
        });
      })
  );

  it.effect(
    "lets the school's own student in without a write, makes a student of another unit one of the room's, and refuses staff",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const scanned = { sittingId: made.id, slug: nf, token: made.token };
        expect(yield* fixture.as("student").mutation(join, scanned)).toEqual({
          outcome: "joined",
          sittingId: made.id,
        });
        const sma = yield* newcomer(fixture, "sma");
        yield* seedMember(fixture, sma.userId, [fixture.units.sma]);
        expect(yield* sma.client.mutation(join, scanned)).toEqual({
          outcome: "joined",
          sittingId: made.id,
        });
        expect(
          Arr.map((yield* personOf(fixture, sma.userId)).grants, (grant) =>
            grant.scope.kind === "unit" ? grant.scope.unitId : null
          )
        ).toEqual([fixture.units.sma, fixture.units.smp]);
        const staff: readonly ("suspended" | "teacher" | "visitor")[] = [
          "teacher",
          "suspended",
          "visitor",
        ];
        const refusals = yield* Effect.forEach(staff, (caller) =>
          fixture.as(caller).mutation(join, scanned)
        );
        expect(refusals).toEqual(
          Arr.map(staff, () => ({ outcome: "refused", reason: "NotAdmitted" }))
        );
      })
  );

  it.effect("refuses a student who graduated from the room's unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const graduate = yield* newcomer(fixture, "graduate");
      const personId = yield* seedMember(fixture, graduate.userId, [
        fixture.units.sma,
      ]);
      yield* fixture.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const periodId = yield* writer.table("tenantPeriods").insert({
            end: "2026-12-19",
            name: "Ganjil",
            start: "2026-07-13",
            status: "active",
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smp,
          });
          const promotionId = yield* writer.table("tenantPromotions").insert({
            copies: [],
            created: [],
            progress: {
              cursor: null,
              direction: null,
              done: [],
              failure: null,
              movedAt: 0,
              running: false,
              step: null,
            },
            returnReason: null,
            sourcePeriodId: periodId,
            sources: [],
            state: "opened",
            targetPeriodId: periodId,
            targets: [],
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smp,
          });
          yield* writer.table("tenantGraduates").insert({
            personId,
            promotionId,
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smp,
          });
        })
      );
      expect(
        yield* graduate.client.mutation(join, {
          sittingId: made.id,
          slug: nf,
          token: made.token,
        })
      ).toEqual({ outcome: "refused", reason: "NotAdmitted" });
    })
  );

  it.effect("admits only the email domains of a school that lists them", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* fixture.run(
        Effect.gen(function* () {
          yield* (yield* DatabaseWriter)
            .table("tenants")
            .patch(fixture.tenants.nf, {
              policies: {
                ...NEW_TENANT_POLICIES,
                emailDomains: ["sekolah.sch.id"],
              },
            });
        })
      );
      const scanned = { sittingId: made.id, slug: nf, token: made.token };
      const personal = yield* newcomer(fixture, "personal");
      expect(yield* personal.client.mutation(join, scanned)).toEqual({
        outcome: "refused",
        reason: "NotAdmitted",
      });
      const workspace = yield* fixture.account(
        "workspace",
        "siswa@sekolah.sch.id",
        true,
        "sekolah.sch.id"
      );
      expect(yield* workspace.client.mutation(join, scanned)).toEqual({
        outcome: "joined",
        sittingId: made.id,
      });
    })
  );

  it.effect(
    "places a newcomer and a member with no class in a cohort room's class, and refuses a student of another class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const cohortId = yield* seedPlacement(
          fixture,
          fixture.people.student.personId
        );
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { cohortId, kind: "cohort" },
          opensAt: OPENS_AT,
        });
        vi.setSystemTime(OPENS_AT);
        yield* fixture.internal.mutation(open, { sittingId: made.id });
        const scanned = { sittingId: made.id, slug: nf, token: made.token };

        const account = yield* newcomer(fixture, "cohort");
        expect(yield* account.client.mutation(join, scanned)).toEqual({
          outcome: "joined",
          sittingId: made.id,
        });
        const roleless = yield* newcomer(fixture, "classless");
        const rolelessId = yield* seedMember(fixture, roleless.userId, []);
        expect(yield* roleless.client.mutation(join, scanned)).toEqual({
          outcome: "joined",
          sittingId: made.id,
        });
        const placed = yield* fixture.run(
          Effect.gen(function* () {
            return yield* (yield* DatabaseReader)
              .table("tenantCohortMembers")
              .index("by_cohortId_and_personId", (query) =>
                query.eq("cohortId", cohortId)
              )
              .collect();
          })
        );
        expect(placed).toHaveLength(3);
        expect(Arr.map(placed, (row) => row.personId)).toContain(rolelessId);

        const other = yield* newcomer(fixture, "other");
        const otherId = yield* seedMember(fixture, other.userId, [
          fixture.units.smp,
        ]);
        yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const cohort = yield* reader.table("tenantCohorts").get(cohortId);
            const otherCohort = yield* writer.table("tenantCohorts").insert({
              grade: 10,
              name: "10B",
              nameKey: "10b",
              periodId: cohort.periodId,
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
            });
            yield* writer.table("tenantCohortMembers").insert({
              cohortId: otherCohort,
              periodId: cohort.periodId,
              personId: otherId,
              tenantId: fixture.tenants.nf,
            });
          })
        );
        expect(yield* other.client.mutation(join, scanned)).toEqual({
          outcome: "refused",
          reason: "NotAdmitted",
        });
      })
  );
});

import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  claimedMembers,
  grantRole,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const nf = slugOf("nf");
const calon = Schema.decodeSync(Email)("calon@harapan.example.test");
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const { create, list, remove, rename } = refs.public.tenancy.people;
const { invite, list: invites } = refs.public.tenancy.invites;
const { place } = refs.public.tenancy.placements;
const { archive: archiveCohort, create: createCohort } =
  refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const holdersSchedule = refs.internal.tenancy.holders.schedule;
const claimsRun = refs.internal.tenancy.claims.run;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

describe("tenancy/people list and create", () => {
  it.effect(
    "lists the people of one status, with whether each holds an account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const active = yield* fixture.as("admin").query(list, {
          paginationOpts: { cursor: null, numItems: 20 },
          slug: nf,
          status: "active",
        });
        const [owner] = Arr.filter(
          active.page,
          (person) => person.id === fixture.people.owner.personId
        );
        expect(owner).toMatchObject({
          account: "claimed",
          kind: "member",
          name: "Owner",
          status: "active",
        });
        const ids = Arr.map(active.page, (person) => person.id);
        expect(ids).toContain(fixture.invited);
        expect(ids).not.toContain(fixture.people.suspended.personId);
      })
  );

  it.effect(
    "lists only the unclaimed Persons, including one created after the hundredth active Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(claimedMembers(fixture.tenants.nf, 100));
        const made = yield* fixture
          .as("admin")
          .mutation(create, { name: "Guru Baru", slug: nf });
        const unclaimed = yield* fixture.as("admin").query(list, {
          ...firstPage,
          account: "unclaimed",
          slug: nf,
          status: "active",
        });
        expect(Arr.map(unclaimed.page, (person) => person.id)).toEqual([
          fixture.invited,
          made.id,
        ]);
      })
  );

  it.effect("refuses the list to a student and to a unit's Admin", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const student = yield* fixture
        .as("student")
        .query(list, { ...firstPage, slug: nf, status: "active" })
        .pipe(Effect.flip);
      const unitAdmin = yield* fixture
        .as("unitAdmin")
        .query(list, { ...firstPage, slug: nf, status: "active" })
        .pipe(Effect.flip);
      expect([student, unitAdmin]).toMatchObject([
        denied("role"),
        denied("role"),
      ]);
    })
  );

  it.effect("creates an unclaimed member Person, and records it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture
        .as("admin")
        .mutation(create, { name: "Guru Baru", slug: nf });
      expect(made).toEqual({
        account: "unclaimed",
        id: expect.any(String),
        kind: "member",
        name: "Guru Baru",
        status: "active",
      });
      expect(yield* fixture.run(journal)).toMatchObject([
        {
          actor: { id: fixture.people.admin.personId, kind: "person" },
          change: { type: "person.created" },
          subject: { id: made.id, kind: "person" },
        },
      ]);
    })
  );

  it.effect("refuses a create by a teacher and by a unit's Admin", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = yield* fixture
        .as("teacher")
        .mutation(create, { name: "Guru", slug: nf })
        .pipe(Effect.flip);
      const unitAdmin = yield* fixture
        .as("unitAdmin")
        .mutation(create, { name: "Guru", slug: nf })
        .pipe(Effect.flip);
      expect([teacher, unitAdmin]).toMatchObject([
        denied("role"),
        denied("role"),
      ]);
    })
  );
});

describe("tenancy/people rename and remove", () => {
  it.effect(
    "renames a Person, keeps a name it already has, and records the change",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const renamed = yield* fixture.as("admin").mutation(rename, {
          name: "Pak Guru",
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const same = yield* fixture.as("admin").mutation(rename, {
          name: "Pak Guru",
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        expect([renamed.name, same.name]).toEqual(["Pak Guru", "Pak Guru"]);
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            change: { type: "person.renamed" },
            subject: { id: fixture.people.teacher.personId, kind: "person" },
          },
        ]);
      })
  );

  it.effect(
    "removes a Person: grants end, placements end, the pending invite is revoked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const period = yield* admin.mutation(periods.create, {
          end: "2026-12-19",
          name: "Ganjil",
          slug: nf,
          start: "2026-07-13",
          unitId: fixture.units.sma,
        });
        const seventh = yield* admin.mutation(createCohort, {
          grade: 7,
          name: "7A",
          periodId: period.id,
          slug: nf,
        });
        yield* fixture.run(
          grantRole(fixture.tenants.nf, fixture.invited, "student", {
            kind: "tenant",
          })
        );
        yield* admin.mutation(place, {
          cohortId: seventh.id,
          personId: fixture.invited,
          slug: nf,
        });
        yield* admin.mutation(invite, {
          email: calon,
          locale: "id",
          personId: fixture.invited,
          slug: nf,
        });
        const removed = yield* admin.mutation(remove, {
          personId: fixture.people.student.personId,
          slug: nf,
        });
        expect(removed).toMatchObject({
          account: "unclaimed",
          id: fixture.people.student.personId,
          status: "removed",
        });
        const grant = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(fixture.people.student.grantId)
          )
        );
        expect(grant.status).toBe("revoked");
        const pendingRemoved = yield* admin.mutation(remove, {
          personId: fixture.invited,
          slug: nf,
        });
        expect(pendingRemoved.status).toBe("removed");
        const invitesLeft = yield* admin.query(invites, {
          ...firstPage,
          slug: nf,
        });
        expect(invitesLeft.page).toEqual([]);
        const placements = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("tenantCohortMembers")
              .index("by_personId", (query) =>
                query.eq("personId", fixture.invited)
              )
              .take(10)
          )
        );
        expect(placements).toEqual([]);
        const refused = yield* admin
          .mutation(rename, {
            name: "Tidak Bisa",
            personId: fixture.people.student.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("condition"));
        const studentReads = yield* fixture
          .as("student")
          .query(list, { ...firstPage, slug: nf, status: "active" })
          .pipe(Effect.flip);
        expect(studentReads).toMatchObject(notMember);
      })
  );

  it.effect(
    "releases a removed Person's account, so the account can be invited again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const account = yield* fixture.account("guru", guru, true);
        yield* admin.mutation(invite, {
          email: guru,
          locale: "id",
          personId: fixture.invited,
          slug: nf,
        });
        yield* fixture.internal.mutation(holdersSchedule, {
          cursor: null,
          email: guru,
        });
        yield* fixture.internal.mutation(claimsRun, {
          cursor: null,
          userId: account.userId,
        });
        const removed = yield* admin.mutation(remove, {
          personId: fixture.invited,
          slug: nf,
        });
        expect(removed).toMatchObject({
          account: "unclaimed",
          status: "removed",
        });
        const replacement = yield* admin.mutation(create, {
          name: "Pengganti",
          slug: nf,
        });
        yield* admin.mutation(invite, {
          email: guru,
          locale: "id",
          personId: replacement.id,
          slug: nf,
        });
        yield* fixture.internal.mutation(holdersSchedule, {
          cursor: null,
          email: guru,
        });
        yield* fixture.internal.mutation(claimsRun, {
          cursor: null,
          userId: account.userId,
        });
        const claimed = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(replacement.id)
          )
        );
        expect(claimed.account).toMatchObject({
          state: "claimed",
          userId: account.userId,
        });
        const entries = Arr.filter(
          yield* fixture.run(journal),
          (entry) =>
            entry.change.type === "person.released" ||
            entry.change.type === "person.removed"
        );
        expect(entries).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "person.released" },
            subject: { id: fixture.invited, kind: "person" },
          },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "person.removed" },
            subject: { id: fixture.invited, kind: "person" },
          },
        ]);
      })
  );

  it.effect(
    "journals only the removal of a Person who never held an account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const made = yield* admin.mutation(create, {
          name: "Tanpa Akun",
          slug: nf,
        });
        yield* admin.mutation(remove, { personId: made.id, slug: nf });
        const entries = Arr.filter(
          yield* fixture.run(journal),
          (entry) => entry.subject.id === made.id
        );
        expect(entries).toMatchObject([
          { change: { type: "person.created" } },
          { change: { type: "person.removed" } },
        ]);
      })
  );

  it.effect(
    "keeps a removed Person's placements in an archived period and an archived cohort, and ends the rest",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        yield* fixture.run(
          grantRole(fixture.tenants.nf, fixture.invited, "student", {
            kind: "tenant",
          })
        );
        const spring = yield* admin.mutation(periods.create, {
          end: "2026-06-20",
          name: "Genap 2026",
          slug: nf,
          start: "2026-01-05",
          unitId: fixture.units.sma,
        });
        const springRoom = yield* admin.mutation(createCohort, {
          grade: 7,
          name: "7A",
          periodId: spring.id,
          slug: nf,
        });
        yield* admin.mutation(periods.open, { periodId: spring.id, slug: nf });
        yield* admin.mutation(place, {
          cohortId: springRoom.id,
          personId: fixture.invited,
          slug: nf,
        });
        yield* admin.mutation(periods.archive, {
          periodId: spring.id,
          slug: nf,
        });
        const autumn = yield* admin.mutation(periods.create, {
          end: "2026-12-19",
          name: "Ganjil 2026",
          slug: nf,
          start: "2026-07-13",
          unitId: fixture.units.sma,
        });
        const autumnRoom = yield* admin.mutation(createCohort, {
          grade: 8,
          name: "8A",
          periodId: autumn.id,
          slug: nf,
        });
        yield* admin.mutation(periods.open, { periodId: autumn.id, slug: nf });
        yield* admin.mutation(place, {
          cohortId: autumnRoom.id,
          personId: fixture.invited,
          slug: nf,
        });
        yield* admin.mutation(archiveCohort, {
          cohortId: autumnRoom.id,
          slug: nf,
        });
        const next = yield* admin.mutation(periods.create, {
          end: "2027-06-18",
          name: "Genap 2027",
          slug: nf,
          start: "2027-01-04",
          unitId: fixture.units.sma,
        });
        const nextRoom = yield* admin.mutation(createCohort, {
          grade: 8,
          name: "8B",
          periodId: next.id,
          slug: nf,
        });
        yield* admin.mutation(place, {
          cohortId: nextRoom.id,
          personId: fixture.invited,
          slug: nf,
        });
        yield* admin.mutation(remove, { personId: fixture.invited, slug: nf });
        const kept = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("tenantCohortMembers")
              .index("by_personId", (query) =>
                query.eq("personId", fixture.invited)
              )
              .take(10)
          )
        );
        expect(Arr.map(kept, (placement) => placement.periodId)).toEqual([
          spring.id,
          autumn.id,
        ]);
      })
  );

  it.effect(
    "refuses to remove the school's last Owner, and an Owner by an Admin",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const lastOwner = yield* fixture
          .as("owner")
          .mutation(remove, {
            personId: fixture.people.owner.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        const ownerByAdmin = yield* fixture
          .as("admin")
          .mutation(remove, {
            personId: fixture.people.owner.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(lastOwner).toMatchObject({
          _tag: "GrantRejected",
          code: "LAST_OWNER",
        });
        expect(ownerByAdmin).toMatchObject(denied("role"));
      })
  );

  it.effect("refuses to rename or remove a Person of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const renamed = yield* fixture
        .as("admin")
        .mutation(rename, {
          name: "Asing",
          personId: fixture.people.otherOwner.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      const removed = yield* fixture
        .as("admin")
        .mutation(remove, {
          personId: fixture.people.otherOwner.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect([renamed, removed]).toMatchObject([
        denied("resource"),
        denied("resource"),
      ]);
    })
  );
});

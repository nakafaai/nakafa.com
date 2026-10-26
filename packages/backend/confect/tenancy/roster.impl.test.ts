import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Record as Rec,
  Schema,
} from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const { invite: inviteMember, members } = refs.public.tenancy.roster;
const everyone = { paginationOpts: { cursor: null, numItems: 100 } };
const outsideAddress = Schema.decodeSync(Email)("guru@luar.example.test");
const guruBaru = {
  email: Schema.decodeSync(Email)("guru.baru@harapan.example.test"),
  locale: "id",
  name: "Guru Baru",
  role: "teacher",
  slug: nf,
} as const;

describe("tenancy/roster invite and members", () => {
  it.effect(
    "adds a teacher with the role and the invite in one step, and journals each write",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const added = yield* fixture
          .as("admin")
          .mutation(inviteMember, guruBaru);
        expect(added).toEqual({
          invite: expect.any(String),
          person: expect.any(String),
        });
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(listed.page).toContainEqual({
          id: added.person,
          name: "Guru Baru",
          removable: true,
          roles: ["teacher"],
          status: "invited",
        });
        const entries = yield* fixture.run(journal);
        expect(Arr.map(entries, (entry) => entry.change.type)).toEqual(
          expect.arrayContaining([
            "person.created",
            "grant.created",
            "person.invited",
          ])
        );
        expect(entries).toHaveLength(3);
      })
  );

  it.effect("gives the Admin role only through an Owner", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const byAdmin = yield* fixture
        .as("admin")
        .mutation(inviteMember, { ...guruBaru, role: "admin" })
        .pipe(Effect.flip);
      expect(byAdmin).toMatchObject(denied("role"));
      const byOwner = yield* fixture
        .as("owner")
        .mutation(inviteMember, { ...guruBaru, role: "admin" });
      expect(byOwner).toEqual({
        invite: expect.any(String),
        person: expect.any(String),
      });
    })
  );

  it.effect("refuses an invite by a teacher, and writes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refused = yield* fixture
        .as("teacher")
        .mutation(inviteMember, guruBaru)
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect(
    "refuses a second invite to an address with a pending invite here, so a retry adds nobody twice",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.as("admin").mutation(inviteMember, guruBaru);
        const retried = yield* fixture
          .as("admin")
          .mutation(inviteMember, guruBaru)
          .pipe(Effect.flip);
        expect(retried).toMatchObject({
          _tag: "AddressInvited",
          code: "ADDRESS_INVITED",
        });
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(
          Arr.filter(listed.page, (member) => member.name === "Guru Baru")
        ).toHaveLength(1);
      })
  );

  it.effect("refuses an address on a domain the school does not admit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenants").patch(fixture.tenants.nf, {
            policies: {
              emailDomains: ["harapan.example.test"],
              nina: false,
              studentThreads: false,
            },
          })
        )
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(inviteMember, {
          ...guruBaru,
          email: outsideAddress,
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "InviteDomainRefused" });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect(
    "marks the members the caller may remove, as a removal decides it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const removableAs = (account: "admin" | "owner" | "auditor") =>
          fixture
            .as(account)
            .query(members, { ...everyone, slug: nf })
            .pipe(
              Effect.map((listed) =>
                Rec.fromEntries(
                  Arr.map(listed.page, (row) => [row.name, row.removable])
                )
              )
            );
        expect(yield* removableAs("admin")).toMatchObject({
          Admin: false,
          Owner: false,
          Student: true,
          Teacher: true,
          "Unit Admin": false,
        });
        expect(yield* removableAs("owner")).toMatchObject({
          Admin: true,
          Owner: false,
          Teacher: true,
          "Unit Admin": true,
        });
        expect(yield* removableAs("auditor")).toMatchObject({
          Admin: false,
          Owner: false,
        });
      })
  );

  it.effect("refuses another school's members and invites", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const listed = yield* fixture
        .as("admin")
        .query(members, { ...everyone, slug: other })
        .pipe(Effect.flip);
      const invited = yield* fixture
        .as("admin")
        .mutation(inviteMember, { ...guruBaru, slug: other })
        .pipe(Effect.flip);
      expect([listed, invited]).toMatchObject([
        { _tag: "NotMember" },
        { _tag: "NotMember" },
      ]);
    })
  );

  it.effect(
    "lets another school invite an address that this school invited",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.as("admin").mutation(inviteMember, guruBaru);
        const invitedElsewhere = yield* fixture
          .as("otherOwner")
          .mutation(inviteMember, { ...guruBaru, slug: other });
        expect(invitedElsewhere).toEqual({
          invite: expect.any(String),
          person: expect.any(String),
        });
      })
  );

  it.effect(
    "invites an address whose earlier invite has ended into the same Person, so the address keeps one row",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const earlier = yield* fixture.run(
          Effect.gen(function* () {
            const seeded = yield* invitePerson(
              fixture.tenants.nf,
              guruBaru.email
            );
            yield* (yield* DatabaseWriter)
              .table("tenantInvites")
              .patch(seeded.inviteId, { expiresAt: 0 });
            return seeded;
          })
        );
        const invitedAgain = yield* fixture
          .as("admin")
          .mutation(inviteMember, guruBaru);
        expect(invitedAgain).toEqual({
          invite: expect.any(String),
          person: earlier.personId,
        });
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(
          Arr.filter(listed.page, (member) => member.name === "Guru Baru")
        ).toEqual([
          {
            id: earlier.personId,
            name: "Guru Baru",
            removable: true,
            roles: ["teacher"],
            status: "invited",
          },
        ]);
        expect(
          Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
        ).toEqual([
          "invite.expired",
          "person.renamed",
          "grant.created",
          "person.invited",
        ]);
      })
  );

  it.effect(
    "invites an address whose invite was revoked into the same Person, which keeps its name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const earlier = yield* fixture.run(
          invitePerson(fixture.tenants.nf, guruBaru.email, {
            invite: { at: TENANCY_NOW, status: "revoked" },
          })
        );
        const invitedAgain = yield* fixture
          .as("admin")
          .mutation(inviteMember, { ...guruBaru, name: "Invited Person" });
        expect(invitedAgain.person).toBe(earlier.personId);
        expect(
          Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
        ).toEqual(["grant.created", "person.invited"]);
      })
  );

  it.effect(
    "refuses an address whose invited Person an account has claimed, since that member already belongs to the school, and adds no second Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          invitePerson(fixture.tenants.nf, guruBaru.email, {
            account: {
              claimedAt: TENANCY_NOW,
              method: "invite",
              state: "claimed",
              userId: fixture.users.stranger.userId,
            },
            invite: {
              at: TENANCY_NOW,
              status: "accepted",
              userId: fixture.users.stranger.userId,
            },
          })
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(inviteMember, guruBaru)
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "AddressMember",
          code: "ADDRESS_MEMBER",
        });
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(
          Arr.filter(listed.page, (member) => member.name === guruBaru.name)
        ).toEqual([]);
      })
  );

  it.effect(
    "gives no new invite to a Person whose invite to another address still waits, so the address gets a new Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const waiting = yield* fixture.run(
          Effect.gen(function* () {
            const seeded = yield* invitePerson(
              fixture.tenants.nf,
              guruBaru.email,
              { invite: { at: TENANCY_NOW, status: "revoked" } }
            );
            const now = yield* Clock.currentTimeMillis;
            yield* (yield* DatabaseWriter).table("tenantInvites").insert({
              channel: { email: outsideAddress, kind: "email" },
              expiresAt: now + Duration.toMillis(Duration.days(1)),
              personId: seeded.personId,
              state: { status: "pending" },
              tenantId: fixture.tenants.nf,
            });
            return seeded;
          })
        );
        const invitedAgain = yield* fixture
          .as("admin")
          .mutation(inviteMember, guruBaru);
        expect(invitedAgain.person).not.toBe(waiting.personId);
      })
  );

  it.effect(
    "gives no new invite to a Person that has left the school, so the address gets a new Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const left = yield* fixture.run(
          invitePerson(fixture.tenants.nf, guruBaru.email, {
            invite: { at: TENANCY_NOW, status: "revoked" },
            person: "removed",
          })
        );
        const invitedAgain = yield* fixture
          .as("admin")
          .mutation(inviteMember, guruBaru);
        expect(invitedAgain.person).not.toBe(left.personId);
      })
  );

  it.effect(
    "shows a card past its term as not invited, and a card within its term as card issued",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const seeded = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const now = yield* Clock.currentTimeMillis;
            const issuedBy = fixture.people.admin.personId;
            const lapsed = yield* writer.table("tenantPeople").insert({
              account: { state: "unclaimed" },
              kind: "member",
              name: "Kartu Lewat",
              status: "active",
              tenantId: fixture.tenants.nf,
            });
            const current = yield* writer.table("tenantPeople").insert({
              account: { state: "unclaimed" },
              kind: "member",
              name: "Kartu Berlaku",
              status: "active",
              tenantId: fixture.tenants.nf,
            });
            yield* writer.table("loginCards").insert({
              codeHash: "lapsed",
              expiresAt: 0,
              issuedAt: 0,
              issuedBy,
              personId: lapsed,
              tenantId: fixture.tenants.nf,
            });
            yield* writer.table("loginCards").insert({
              codeHash: "current",
              expiresAt: now + Duration.toMillis(Duration.days(1)),
              issuedAt: now,
              issuedBy,
              personId: current,
              tenantId: fixture.tenants.nf,
            });
            return { current, lapsed };
          })
        );
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        expect(listed.page).toEqual(
          expect.arrayContaining([
            {
              id: seeded.lapsed,
              name: "Kartu Lewat",
              removable: true,
              roles: [],
              status: "notInvited",
            },
            {
              id: seeded.current,
              name: "Kartu Berlaku",
              removable: true,
              roles: [],
              status: "cardIssued",
            },
          ])
        );
      })
  );

  it.effect(
    "lists each active member with its roles and whether it has joined, and leaves out the suspended",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const listed = yield* fixture
          .as("admin")
          .query(members, { ...everyone, slug: nf });
        const [owner] = Arr.filter(
          listed.page,
          (member) => member.id === fixture.people.owner.personId
        );
        expect(owner).toMatchObject({
          name: "Owner",
          roles: expect.arrayContaining(["owner"]),
          status: "joined",
        });
        expect(Arr.map(listed.page, (member) => member.id)).not.toContain(
          fixture.people.suspended.personId
        );
      })
  );
});

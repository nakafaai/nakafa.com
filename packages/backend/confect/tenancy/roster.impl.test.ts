import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

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
    "lets an address whose earlier invite has ended be invited again",
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
          person: expect.any(String),
        });
        expect(invitedAgain.person).not.toBe(earlier.personId);
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

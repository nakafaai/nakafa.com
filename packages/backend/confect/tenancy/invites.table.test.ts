import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Email, INVITE_TERM } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Duration, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const TERM = Duration.toMillis(INVITE_TERM);
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const lain = Schema.decodeSync(Email)("lain@lain.example.test");
const nf = slugOf("nf");
const { invite, list, revoke } = refs.public.tenancy.invites;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

/** Fake timers keep every scheduled job from starting before the test looks at it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

/** Invites the fixture's unclaimed Person at an address, as the school's Admin. */
const inviteInvited = (
  fixture: Effect.Success<typeof tenancyFixture>,
  email = guru,
  locale: "de" | "en" | "id" = "id"
) =>
  fixture.as("admin").mutation(invite, {
    email,
    locale,
    personId: fixture.invited,
    slug: nf,
  });

describe("tenancy/invites list and revoke", () => {
  it.effect("lists the pending invites, and revoking one ends it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* inviteInvited(fixture);
      const pending = yield* fixture
        .as("admin")
        .query(list, { ...firstPage, slug: nf });
      expect(pending.page).toEqual([made]);
      expect(
        yield* fixture
          .as("admin")
          .mutation(revoke, { inviteId: made.id, slug: nf })
      ).toBeNull();
      expect(
        yield* fixture
          .as("admin")
          .mutation(revoke, { inviteId: made.id, slug: nf })
      ).toBeNull();
      const after = yield* fixture
        .as("admin")
        .query(list, { ...firstPage, slug: nf });
      expect(after.page).toEqual([]);
      expect(yield* fixture.run(journal)).toMatchObject([
        { change: { type: "person.invited" } },
        {
          change: { invite: made.id, type: "invite.revoked" },
          subject: { id: fixture.invited, kind: "person" },
        },
      ]);
    })
  );

  it.effect(
    "lists the pending invites before the expired ones, with each status and roles",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const expired = yield* fixture.run(
          invitePerson(fixture.tenants.nf, lain, {
            invite: { at: NOW - 1, status: "expired" },
          })
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantGrants").insert({
              grantedBy: { kind: "system" },
              personId: fixture.invited,
              role: { key: "teacher", kind: "builtin" },
              scope: { kind: "tenant" },
              status: "active",
              tenantId: fixture.tenants.nf,
              term: { kind: "standing" },
            })
          )
        );
        const pending = yield* inviteInvited(fixture);
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, slug: nf });
        expect(listed.page).toEqual([
          { ...pending, roles: ["teacher"] },
          {
            email: lain,
            expiresAt: TENANCY_NOW + TERM,
            id: expired.inviteId,
            name: "Invited Person",
            personId: expired.personId,
            roles: [],
            status: "expired",
          },
        ]);
      })
  );

  it.effect("refuses to revoke an invite that does not exist", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.run(invitePerson(fixture.tenants.nf, guru));
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantInvites").delete(made.inviteId)
        )
      );
      const missing = yield* fixture
        .as("admin")
        .mutation(revoke, { inviteId: made.inviteId, slug: nf })
        .pipe(Effect.flip);
      expect(missing).toMatchObject(denied("resource"));
    })
  );

  it.effect("leaves an accepted invite alone when it is revoked", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const accepted = yield* fixture.run(
        invitePerson(fixture.tenants.nf, guru, {
          account: { state: "unclaimed" },
          invite: {
            at: NOW,
            status: "accepted",
            userId: fixture.users.teacher.userId,
          },
        })
      );
      yield* fixture
        .as("admin")
        .mutation(revoke, { inviteId: accepted.inviteId, slug: nf });
      const entries = yield* fixture.run(journal);
      expect(entries).toEqual([]);
    })
  );
});

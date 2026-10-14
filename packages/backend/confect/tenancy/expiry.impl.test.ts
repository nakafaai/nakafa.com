import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  journal,
  slugOf,
  suspend,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const nf = slugOf("nf");
const expire = refs.internal.tenancy.expiry.invite;
const claimsRun = refs.internal.tenancy.claims.run;
const { revoke } = refs.public.tenancy.invites;

/** Reads one stored invite of the fixture's school. */
const readInvite = (
  fixture: Effect.Success<typeof tenancyFixture>,
  inviteId: GenericId.GenericId<"tenantInvites">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenantInvites").get(inviteId)
    )
  );

/** Fake timers keep every scheduled job from starting before the test runs it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("tenancy/expiry invite", () => {
  it.effect("expires an invite while its school is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, guru)
      );
      yield* fixture.run(suspend(fixture.tenants.nf));
      yield* fixture.internal.mutation(expire, { inviteId });
      expect(yield* fixture.run(journal)).toMatchObject([
        {
          actor: { kind: "system" },
          change: { invite: inviteId, type: "invite.expired" },
          subject: { id: personId, kind: "person" },
        },
      ]);
    })
  );

  it.effect(
    "marks a pending invite expired, once, and records it under its Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { inviteId, personId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, guru)
        );
        yield* fixture.internal.mutation(expire, { inviteId });
        yield* fixture.internal.mutation(expire, { inviteId });
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { kind: "system" },
            change: { invite: inviteId, type: "invite.expired" },
            subject: { id: personId, kind: "person" },
          },
        ]);
      })
  );

  it.effect("leaves an invite that was revoked before its term as it is", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { inviteId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, guru)
      );
      yield* fixture.as("admin").mutation(revoke, { inviteId, slug: nf });
      yield* fixture.internal.mutation(expire, { inviteId });
      expect(yield* fixture.run(journal)).toMatchObject([
        { change: { type: "invite.revoked" } },
      ]);
    })
  );

  it.effect(
    "refuses to claim an invite at the moment its term ends, before the expiry job runs",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("guru", guru, true);
        const { inviteId, personId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, guru)
        );
        const written = yield* readInvite(fixture, inviteId);
        vi.setSystemTime(written.expiresAt);
        yield* fixture.internal.mutation(claimsRun, {
          cursor: null,
          userId: account.userId,
        });
        const after = yield* readInvite(fixture, inviteId);
        const person = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(personId)
          )
        );
        expect([after.state, person.account]).toEqual([
          { status: "pending" },
          { state: "unclaimed" },
        ]);
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );
});

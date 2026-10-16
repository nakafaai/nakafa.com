import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { finalizeAccountDeletion } from "@repo/backend/confect/auth/deletion/finalize";
import { releaseTenantPeople } from "@repo/backend/confect/auth/deletion/release";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  grantsOf,
  operatorAccount,
  personOf,
} from "@repo/backend/test/operators";
import {
  invitePerson,
  journal,
  slugOf,
  suspend,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const guru = Schema.decodeSync(Email)("guru@harapan.example.test");
const BATCH_PLUS_ONE = ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1;
const nf = slugOf("nf");
const requestVisit = refs.public.operators.visits.request;
const approve = refs.public.operators.visits.approve;
const endVisit = refs.public.operators.visits.end;

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Claims `count` new Persons of the school for one account, the way a deleted account leaves them. */
const claimPersons = (
  fixture: Fixture,
  userId: GenericId.GenericId<"users">,
  count: number
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      Effect.forEach(
        Arr.makeBy(count, (index) => index),
        (index) =>
          writer.table("tenantPeople").insert({
            account: {
              claimedAt: NOW,
              method: "operator",
              state: "claimed",
              userId,
            },
            kind: "member",
            name: `Siswa ${index}`,
            status: "active",
            tenantId: fixture.tenants.nf,
          }),
        { discard: true }
      )
    )
  );

/** The Persons that still name the account, up to one batch more than it releases at a time. */
const claimedBy = (fixture: Fixture, userId: GenericId.GenericId<"users">) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("tenantPeople")
        .index("by_account_userId_and_kind_and_status", (query) =>
          query.eq("account.userId", userId)
        )
        .take(BATCH_PLUS_ONE)
    )
  );

/** Fake timers keep the deletion's scheduled cleanup from starting during the test. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe("auth/deletion release", () => {
  it.effect(
    "releases a deleted account's Person: unclaimed, its accepted invite revoked, and journaled",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("guru", guru, true);
        const { inviteId, personId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, guru, {
            account: {
              claimedAt: NOW,
              method: "invite",
              state: "claimed",
              userId: account.userId,
            },
            invite: {
              at: NOW,
              status: "accepted",
              userId: account.userId,
            },
          })
        );
        yield* fixture.run(finalizeAccountDeletion(account.authUserId));
        const released = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            Effect.all({
              invite: reader.table("tenantInvites").get(inviteId),
              person: reader.table("tenantPeople").get(personId),
            })
          )
        );
        expect(released.person.account).toEqual({ state: "unclaimed" });
        expect(released.invite.state).toEqual({ at: NOW, status: "revoked" });
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { kind: "system" },
            change: { type: "person.released" },
            subject: { id: personId, kind: "person" },
          },
        ]);
      })
  );

  it.effect(
    "ends a deleted operator's approved visit with its account, and suspends the released Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "leaving");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Akun dihapus",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        const person = yield* personOf(fixture, staff.userId);
        yield* fixture.run(finalizeAccountDeletion(staff.authUserId));
        const released = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            Effect.all({
              person: reader.table("tenantPeople").get(person._id),
              visit: reader.table("tenantVisits").get(visit.id),
            })
          )
        );
        expect(released.person).toMatchObject({
          account: { state: "unclaimed" },
          status: "suspended",
        });
        expect(released.visit.state).toEqual({
          at: NOW,
          reason: "left",
          status: "ended",
        });
        expect(yield* grantsOf(fixture, person._id)).toEqual([]);
        expect(Arr.takeRight(yield* fixture.run(journal), 4)).toMatchObject([
          {
            actor: { kind: "system" },
            change: { type: "person.released" },
            subject: { id: person._id, kind: "person" },
          },
          {
            actor: { kind: "system" },
            change: { reason: "left", type: "grant.ended" },
            subject: { id: person._id, kind: "person" },
          },
          {
            actor: { kind: "system" },
            change: { type: "person.suspended" },
            subject: { id: person._id, kind: "person" },
          },
          {
            actor: { kind: "system" },
            change: { reason: "left", type: "visit.ended" },
            subject: { id: visit.id, kind: "visit" },
          },
        ]);
      })
  );

  it.effect(
    "releases a deleted operator whose visit already ended, and journals only the release",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const staff = yield* operatorAccount(fixture, "returned");
        const visit = yield* staff.client.mutation(requestVisit, {
          minutes: 60,
          note: "Sudah pulang",
          reason: "support",
          tenantId: fixture.tenants.nf,
        });
        yield* fixture.as("admin").mutation(approve, {
          slug: nf,
          visitId: visit.id,
        });
        const person = yield* personOf(fixture, staff.userId);
        yield* staff.client.mutation(endVisit, {
          slug: nf,
          visitId: visit.id,
        });
        yield* fixture.run(finalizeAccountDeletion(staff.authUserId));
        const released = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(person._id)
          )
        );
        expect(released).toMatchObject({
          account: { state: "unclaimed" },
          status: "suspended",
        });
        expect(Arr.takeRight(yield* fixture.run(journal), 1)).toMatchObject([
          {
            change: { type: "person.released" },
            subject: { id: person._id, kind: "person" },
          },
        ]);
      })
  );

  it.effect("releases a Person while its school is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", guru, true);
      const { personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, guru, {
          account: {
            claimedAt: NOW,
            method: "invite",
            state: "claimed",
            userId: account.userId,
          },
          invite: { at: NOW, status: "accepted", userId: account.userId },
        })
      );
      yield* fixture.run(suspend(fixture.tenants.nf));
      yield* fixture.run(finalizeAccountDeletion(account.authUserId));
      const person = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("tenantPeople").get(personId)
        )
      );
      expect(person.account).toEqual({ state: "unclaimed" });
    })
  );

  it.effect("releases one batch at a time, and reports the rest", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("kepala", guru, true);
      const user = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("users").get(account.userId)
        )
      );
      yield* claimPersons(fixture, account.userId, BATCH_PLUS_ONE);
      const firstBatch = yield* fixture.run(releaseTenantPeople(user, NOW));
      const lastBatch = yield* fixture.run(releaseTenantPeople(user, NOW));
      expect([
        firstBatch,
        lastBatch,
        yield* claimedBy(fixture, account.userId),
      ]).toEqual([true, false, []]);
    })
  );

  it.effect(
    "finalizes a large deleted account in batches, leaving the rest claimed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("siswa", guru, true);
        yield* claimPersons(fixture, account.userId, BATCH_PLUS_ONE);
        yield* fixture.run(finalizeAccountDeletion(account.authUserId));
        const left = yield* claimedBy(fixture, account.userId);
        expect(Arr.map(left, (person) => person.account.state)).toEqual([
          "claimed",
        ]);
      })
  );

  it.effect("releases nothing for an account that holds no Person", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("sendiri", guru, true);
      const user = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("users").get(account.userId)
        )
      );
      expect(yield* fixture.run(releaseTenantPeople(user, NOW))).toBe(false);
    })
  );
});

import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { CLAIM_PAGE_SIZE } from "@repo/backend/confect/tenancy/claims";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { type Account, Email } from "@repo/backend/confect/tenancy/schema";
import {
  invitePerson,
  scheduledJobs,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);
const address = Schema.decodeSync(Email)("guru@harapan.example.test");
const other = Schema.decodeSync(Email)("lain@harapan.example.test");
const run = refs.internal.tenancy.claims.run;
const viewer = refs.public.tenancy.viewer.get;
const nf = slugOf("nf");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

/** The person, the invite, and the journal after a run. */
const stored = (
  personId: GenericId.GenericId<"tenantPeople">,
  inviteId: GenericId.GenericId<"tenantInvites">
) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return {
      entries: yield* reader
        .table("journalEntries")
        .index("by_creation_time")
        .take(50),
      invite: yield* reader.table("tenantInvites").get(inviteId),
      person: yield* reader.table("tenantPeople").get(personId),
    };
  });

/** The pending invite is untouched: the Person is unclaimed and nothing was recorded. */
const untouched = (after: Effect.Success<ReturnType<typeof stored>>) => {
  expect(after.person.account).toEqual({ state: "unclaimed" });
  expect(after.invite.state).toEqual({ status: "pending" });
  expect(after.entries).toEqual([]);
};

describe("tenancy/claims run", () => {
  it.effect(
    "binds the invited Person to the account that verified the address and accepts the invite",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("guru", address, true);
        const { inviteId, personId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, address)
        );
        const before = yield* account.client
          .query(viewer, { slug: nf })
          .pipe(Effect.flip);
        yield* fixture.internal.mutation(run, {
          cursor: null,
          userId: account.userId,
        });
        const after = yield* fixture.run(stored(personId, inviteId));
        const view = yield* account.client.query(viewer, { slug: nf });
        expect(before).toMatchObject({ _tag: "NotMember" });
        expect(after.person.account).toEqual({
          claimedAt: NOW,
          method: "invite",
          state: "claimed",
          userId: account.userId,
        });
        expect(after.invite.state).toEqual({
          at: NOW,
          status: "accepted",
          userId: account.userId,
        });
        expect(after.entries).toMatchObject([
          {
            actor: { kind: "system" },
            change: { method: "invite", type: "person.claimed" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: personId, kind: "person" },
          },
        ]);
        expect(view.person).toMatchObject({ id: personId, kind: "member" });
      })
  );

  it.effect("claims once, however often it runs", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address)
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      const after = yield* fixture.run(stored(personId, inviteId));
      expect(after.entries).toHaveLength(1);
    })
  );

  it.effect(
    "never claims from an address that Better Auth has not verified",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const account = yield* fixture.account("guru", address, false);
        const { inviteId, personId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, address)
        );
        yield* fixture.internal.mutation(run, {
          cursor: null,
          userId: account.userId,
        });
        untouched(yield* fixture.run(stored(personId, inviteId)));
      })
  );

  it.effect("never claims an invite that names another address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, other)
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      untouched(yield* fixture.run(stored(personId, inviteId)));
    })
  );

  it.effect("never claims an invite that was revoked", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const { personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address, {
          invite: { at: 1, status: "revoked" },
        })
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      const after = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("tenantPeople").get(personId)
        )
      );
      expect(after.account).toEqual({ state: "unclaimed" });
    })
  );

  it.effect("never claims a Person who is no longer active", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address, { person: "removed" })
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      const after = yield* fixture.run(stored(personId, inviteId));
      expect(after.person.account).toEqual({ state: "unclaimed" });
      expect(after.invite.state).toEqual({ status: "pending" });
      expect(after.entries).toEqual([]);
    })
  );

  it.effect(
    "keeps a claimed Person with the first account that claimed it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* fixture.account("first", other, true);
        const second = yield* fixture.account("second", address, true);
        const claimed: typeof Account.Type = {
          claimedAt: 1,
          method: "invite",
          state: "claimed",
          userId: first.userId,
        };
        const { personId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, other, {
            account: claimed,
            invite: { at: 1, status: "accepted", userId: first.userId },
          })
        );
        const reinvite = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantInvites").insert({
              channel: { email: address, kind: "email" },
              personId,
              state: { status: "pending" },
              tenantId: fixture.tenants.nf,
            })
          )
        );
        yield* fixture.internal.mutation(run, {
          cursor: null,
          userId: second.userId,
        });
        const after = yield* fixture.run(stored(personId, reinvite));
        expect(after.person.account).toEqual(claimed);
        expect(after.invite.state).toEqual({ status: "pending" });
        expect(after.entries).toEqual([]);
      })
  );

  it.effect("gives an account one Person in a tenant", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      yield* fixture.run(
        invitePerson(fixture.tenants.nf, other, {
          account: {
            claimedAt: 1,
            method: "invite",
            state: "claimed",
            userId: account.userId,
          },
          invite: { at: 1, status: "accepted", userId: account.userId },
        })
      );
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address)
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      untouched(yield* fixture.run(stored(personId, inviteId)));
    })
  );

  it.effect("claims the invites of every organisation, a page at a time", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const people = yield* fixture.run(
        Effect.forEach(Arr.range(1, CLAIM_PAGE_SIZE + 1), (index) =>
          Effect.gen(function* () {
            const tenantId = yield* Effect.flatMap(DatabaseWriter, (writer) =>
              writer.table("tenants").insert({
                country: "ID",
                currency: "IDR",
                kind: "school",
                name: `Sekolah ${index}`,
                policies: NEW_TENANT_POLICIES,
                slug: slugOf(`sekolah-${index}`),
                status: "active",
              })
            );
            return (yield* invitePerson(tenantId, address)).personId;
          })
        )
      );
      const claimedPeople = Effect.flatMap(DatabaseReader, (reader) =>
        Effect.forEach(people, (id) => reader.table("tenantPeople").get(id))
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      const firstPage = Arr.filter(
        yield* fixture.run(claimedPeople),
        (person) => person.account.state === "claimed"
      );
      const next = Arr.filter(
        yield* fixture.run(scheduledJobs),
        (job) => job.name === "tenancy/claims:run"
      );
      expect(firstPage).toHaveLength(CLAIM_PAGE_SIZE);
      expect(next).toHaveLength(1);
      yield* fixture.internal.mutation(run, {
        cursor: next[0]?.args[0].cursor,
        userId: account.userId,
      });
      const secondPage = Arr.filter(
        yield* fixture.run(claimedPeople),
        (person) => person.account.state === "claimed"
      );
      expect(secondPage).toHaveLength(CLAIM_PAGE_SIZE + 1);
    })
  );

  it.effect("claims nothing for an account that is being deleted", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address)
      );
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("users")
            .patch(account.userId, { deletionPreparedAt: NOW })
        )
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      untouched(yield* fixture.run(stored(personId, inviteId)));
    })
  );

  it.effect("claims nothing for an account that no longer exists", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address)
      );
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("users").delete(account.userId)
        )
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      untouched(yield* fixture.run(stored(personId, inviteId)));
    })
  );

  it.effect("claims nothing when Better Auth no longer holds the user", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const account = yield* fixture.account("guru", address, true);
      const { inviteId, personId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address)
      );
      yield* fixture.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          yield* Effect.promise(() =>
            ctx.runMutation(components.betterAuth.adapter.deleteOne, {
              input: {
                model: "user",
                where: [
                  { field: "_id", operator: "eq", value: account.authUserId },
                ],
              },
            })
          );
        })
      );
      yield* fixture.internal.mutation(run, {
        cursor: null,
        userId: account.userId,
      });
      untouched(yield* fixture.run(stored(personId, inviteId)));
    })
  );
});

import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  journal,
  slugOf,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

/** The instant the inbox fixtures start from, in fake time. */
export const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);
export const nf = slugOf("nf");
export const other = slugOf("other");
const { invite } = refs.public.tenancy.invites;
const consume = refs.internal.notifications.consume.run;

export type Fixture = Effect.Success<typeof tenancyFixture>;
export type PersonId = GenericId.GenericId<"tenantPeople">;
type UserId = GenericId.GenericId<"users">;
type TenantId = GenericId.GenericId<"tenants">;

const address = (value: string) => Schema.decodeSync(Email)(value);

/** Adds an unclaimed, active Person to a school. */
export const addPerson = (fixture: Fixture, tenantId: TenantId, name: string) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantPeople").insert({
        account: { state: "unclaimed" },
        kind: "member",
        name,
        status: "active",
        tenantId,
      })
    )
  );

/** Invites a Person as the Admin of `nf` or the Owner of `other`. */
export const inviteAt = (
  fixture: Fixture,
  school: "nf" | "other",
  personId: PersonId,
  mail: string
) =>
  fixture.as(school === "nf" ? "admin" : "otherOwner").mutation(invite, {
    email: address(mail),
    locale: "id",
    personId,
    slug: school === "nf" ? nf : other,
  });

/** Gives a Person to an account, as a claim does. */
export const claim = (fixture: Fixture, personId: PersonId, userId: UserId) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantPeople").patch(personId, {
        account: {
          claimedAt: NOW,
          method: "invite",
          state: "claimed",
          userId,
        },
      })
    )
  );

/** Runs the inbox consumer of one school to its end. */
export const consumeSchool = (fixture: Fixture, tenantId: TenantId) =>
  fixture.internal.mutation(consume, { tenantId });

/** Every row of the inbox, oldest first, as the table stores it. */
export const storedRows = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("notifications").index("by_creation_time").take(200)
    )
  );

/**
 * Inserts inbox rows for one Person straight into the table. An invite of the
 * fixture's unclaimed Person first makes the journal entry the rows refer to.
 */
export const insertRows = (
  fixture: Fixture,
  personId: PersonId,
  tenantId: TenantId,
  count: number
) =>
  Effect.gen(function* () {
    yield* inviteAt(
      fixture,
      "nf",
      fixture.invited,
      "satu@harapan.example.test"
    );
    const [entry] = yield* fixture.run(journal);
    if (entry === undefined) {
      return yield* Effect.die("The invite must have written a journal entry.");
    }
    yield* fixture.run(
      Effect.flatMap(DatabaseWriter, (writer) =>
        Effect.forEach(
          Arr.makeBy(count, (index) => index),
          (index) =>
            writer.table("notifications").insert({
              changeType: "person.invited",
              createdAt: NOW - index,
              journalEntryId: entry._id,
              recipientPersonId: personId,
              subject: { id: personId, kind: "person" },
              tenantId,
            }),
          { discard: true }
        )
      )
    );
  });

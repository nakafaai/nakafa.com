import type { GenericId } from "@confect/core";
import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Effect, Schema, String as Str } from "effect";

/** Every run of white space or control characters, which a Person's one-line name cannot hold. */
const BREAKS = /[\s\p{Cc}]+/gu;

/** A name cut to one line of at most the 120 characters a Person name holds. */
const oneLine = (text: string) =>
  text.replace(BREAKS, " ").trim().slice(0, 120).trim();

/**
 * The name a Person takes from the account that makes it, as a founder or a student who joins
 * by a room's code: the account's name on one line, with every run of white space or control
 * characters one space, cut to 120 characters. An account whose name holds nothing is named by
 * the part of its email before the `@`, made one line the same way.
 */
export const accountPersonName = (user: UsersDoc) => {
  const name = oneLine(user.name);
  return Schema.decodeSync(PersonName)(
    name === "" ? oneLine(Arr.headNonEmpty(Str.split(user.email, "@"))) : name
  );
};

/**
 * Adds one unclaimed, active member Person to a school and journals its creation
 * under `actor`. The caller's transaction writes the row, so the Person exists only
 * when the rest of that transaction does. Every path that adds a member calls this
 * one function, so each new Person is written and journaled the same way.
 */
export const createPerson = Effect.fn("tenancy.person.create")(function* (
  actor: typeof TenantActor.Type,
  tenantId: GenericId.GenericId<"tenants">,
  name: typeof PersonName.Type
) {
  const personId = yield* (yield* DatabaseWriter)
    .table("tenantPeople")
    .insert({
      account: { state: "unclaimed" },
      kind: "member",
      name,
      status: "active",
      tenantId,
    })
    .pipe(Effect.orDie);
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, person, { type: "person.created" });
  return person;
});

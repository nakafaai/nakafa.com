import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import type { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Effect } from "effect";

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

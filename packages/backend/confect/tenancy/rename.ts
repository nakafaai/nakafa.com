import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import type { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Effect, Struct } from "effect";

/**
 * Renames one Person as `actor` and journals the rename under the Person. A name the
 * Person already holds changes nothing. Returns the Person with the name it holds.
 */
export const renamePerson = Effect.fn("tenancy.person.rename")(function* (
  actor: typeof TenantActor.Type,
  person: TenantPeopleDoc,
  name: typeof PersonName.Type
) {
  if (person.name === name) {
    return person;
  }
  yield* (yield* DatabaseWriter)
    .table("tenantPeople")
    .replace(
      person._id,
      Struct.assign(Struct.omit(person, ["_creationTime", "_id"]), { name })
    )
    .pipe(Effect.orDie);
  yield* personAuthority.record(actor, person, { type: "person.renamed" });
  return Struct.assign(person, { name });
});

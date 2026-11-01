import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { emailOf } from "@repo/backend/confect/tenancy/email";
import type { ListedPerson } from "@repo/backend/confect/tenancy/schema";
import { Effect } from "effect";

/** A Person as a school's table lists them, for the contract that `ListedPerson` declares. */
export const listedPersonOf = Effect.fn("tenancy.listed.of")(function* (
  person: TenantPeopleDoc
) {
  const listed: typeof ListedPerson.Type = {
    email: yield* emailOf(person),
    id: person._id,
    name: person.name,
  };
  return listed;
});

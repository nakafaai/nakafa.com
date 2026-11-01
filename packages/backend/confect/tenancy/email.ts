import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { pendingInviteOf } from "@repo/backend/confect/tenancy/invite";
import { Effect, Option } from "effect";

/**
 * The address of one Person: their account's, or the one their pending invite waits on, and none
 * for a Person with neither, such as a student on a login card.
 */
export const emailOf = Effect.fn("tenancy.email.of")(function* (
  person: TenantPeopleDoc
) {
  if (person.account.state === "claimed") {
    const user = yield* (yield* DatabaseReader)
      .table("users")
      .get(person.account.userId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.orDie
      );
    return Option.getOrNull(Option.map(user, (found) => found.email));
  }
  const invite = yield* pendingInviteOf(person._id);
  return Option.getOrNull(Option.map(invite, (found) => found.channel.email));
});

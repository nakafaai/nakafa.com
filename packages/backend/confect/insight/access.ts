import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { Effect, Option } from "effect";

/** Refuses a Person who is not a student of the allowed class, as a missing object. */
export const requireStudent = Effect.fn("insight.access.student")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  const row = yield* Class;
  const member = yield* (yield* DatabaseReader)
    .table("tenantCohortMembers")
    .index("by_cohortId_and_personId", (query) =>
      query.eq("cohortId", row.cohortId).eq("personId", personId)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(member)) {
    return yield* new AccessDenied({
      action: "insight.teach",
      reason: "resource",
    });
  }
});

import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ConsentRequired } from "@repo/backend/confect/guardians/errors";
import {
  countsUnderAge,
  rosterEntryOf,
} from "@repo/backend/confect/roster/entry";
import { Effect, Option } from "effect";

/**
 * The consent gate of ADR 0034 (K2). A student under the age limit, or with no age
 * flag on the roster, needs a verified guardian link, which stands only while its
 * granted consent is not withdrawn. Without one the student is refused with
 * `ConsentRequired`. Nina, the class forum, and active grading call it for a
 * student; a subject grade that a teacher enters is not active grading (ADR 0033).
 */
export const requireConsent = Effect.fn("guardians.gate.require")(function* (
  studentPersonId: GenericId.GenericId<"tenantPeople">
) {
  if (!countsUnderAge(yield* rosterEntryOf(studentPersonId))) {
    return;
  }
  const verified = yield* (yield* DatabaseReader)
    .table("guardianLinks")
    .index("by_studentPersonId_and_state_status", (query) =>
      query
        .eq("studentPersonId", studentPersonId)
        .eq("state.status", "verified")
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(verified)) {
    return yield* new ConsentRequired();
  }
});

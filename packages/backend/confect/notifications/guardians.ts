import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Array as Arr, Effect } from "effect";

/** The guardians of one student a notice reaches: a student has few, and a page holds them all. */
const GUARDIAN_LIMIT = 10;

/** The active guardians with a verified link to one student. */
export const guardiansOf = Effect.fn("notifications.guardians.of")(function* (
  studentId: GenericId.GenericId<"tenantPeople">
) {
  const reader = yield* DatabaseReader;
  const links = yield* reader
    .table("guardianLinks")
    .index("by_studentPersonId_and_state_status", (query) =>
      query.eq("studentPersonId", studentId).eq("state.status", "verified")
    )
    .take(GUARDIAN_LIMIT)
    .pipe(Effect.orDie);
  const people = yield* Effect.forEach(links, (link) =>
    reader.table("tenantPeople").get(link.guardianPersonId).pipe(Effect.orDie)
  );
  return Arr.filter(people, (person) => person.status === "active");
});

import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { GrantRejected } from "@repo/backend/confect/access/errors";
import { SCHOOL_FREE_STUDENTS } from "@repo/backend/confect/billing/catalog";
import { latestSchoolGrant } from "@repo/backend/confect/billing/grants";
import { Array as Arr, Clock, Effect, HashSet, Option } from "effect";

/**
 * The most student grants one count reads. A student holds one grant per unit
 * they study in, so a school at the free limit holds a few hundred; a paid school
 * is counted for its invoice from the same bound, which a school passes only
 * after it moves to an Enterprise contract.
 */
const STUDENT_GRANT_SCAN = 4096;

/** The students of one school: its Persons who hold an active student grant, each counted once however many units they study in. */
export const countStudents = Effect.fn("billing.seats.countStudents")(
  function* (tenantId: GenericId.GenericId<"tenants">) {
    const grants = yield* (yield* DatabaseReader)
      .table("tenantGrants")
      .index("by_tenantId_and_role_key_and_status", (query) =>
        query
          .eq("tenantId", tenantId)
          .eq("role.key", "student")
          .eq("status", "active")
      )
      .take(STUDENT_GRANT_SCAN)
      .pipe(Effect.orDie);
    return HashSet.size(
      HashSet.fromIterable(Arr.map(grants, (grant) => grant.personId))
    );
  }
);

/**
 * Refuses one more student in a school on the free plan once it holds as many
 * students as the free plan admits (K41). A school whose School grant runs has no
 * limit: it pays per enrolled student (K45).
 */
export const ensureStudentSeat = Effect.fn("billing.seats.ensure")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const now = yield* Clock.currentTimeMillis;
  if (Option.isSome(yield* latestSchoolGrant(tenantId, now))) {
    return;
  }
  if ((yield* countStudents(tenantId)) < SCHOOL_FREE_STUDENTS) {
    return;
  }
  return yield* new GrantRejected({
    code: "SEAT_LIMIT",
    message: `A school on the free plan holds ${SCHOOL_FREE_STUDENTS} students.`,
  });
});

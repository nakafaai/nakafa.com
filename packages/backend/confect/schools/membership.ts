import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Administrators can access every class in their active school membership. */
export function isAdmin(membership: Docs["schoolMembers"] | null | undefined) {
  return membership?.role === "admin";
}

/** Resolve active membership without weakening the unique school-user index. */
export const getSchoolMembership = Effect.fn("schools.membership.read")(
  function* (schoolId: Id<"schools">, userId: Id<"users">) {
    return yield* (yield* DatabaseReader)
      .table("schoolMembers")
      .get("by_schoolId_and_userId_and_status", schoolId, userId, "active")
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

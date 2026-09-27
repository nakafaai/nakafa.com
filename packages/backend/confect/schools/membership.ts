import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Administrators can access every class in their active school membership. */
export function isAdmin(membership: Doc<"schoolMembers"> | null | undefined) {
  return membership?.role === "admin";
}

/** Resolve active membership without weakening the unique school-user index. */
export const getSchoolMembership = Effect.fn("schools.membership.read")(
  function* (
    ctx: QueryCtx | MutationCtx,
    schoolId: Id<"schools">,
    userId: Id<"users">
  ) {
    return yield* DatabaseReader.make(databaseSchema, ctx.db)
      .table("schoolMembers")
      .get("by_schoolId_and_userId_and_status", schoolId, userId, "active")
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

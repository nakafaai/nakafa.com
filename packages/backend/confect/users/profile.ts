import type { GenericId } from "@confect/core";
import { belongsToSchool } from "@repo/backend/confect/tenancy/members";
import { Effect } from "effect";

/**
 * Who opens a profile, with its posts and its comments (K15, ADR 0009, Who Opens A
 * Profile): anyone opens the profile of an account that belongs to no school, and shares
 * it; the profile of a school member opens for its own account alone, and nobody shares
 * it. A caller that may not open it gets the answer of a profile that does not exist.
 */
export const profileAccess = Effect.fn("users.profile.access")(function* (
  holderId: GenericId.GenericId<"users">,
  viewerId: GenericId.GenericId<"users"> | null
) {
  const isMember = yield* belongsToSchool(holderId);
  return { opens: !isMember || holderId === viewerId, shareable: !isMember };
});

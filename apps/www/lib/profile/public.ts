import type { Ref } from "@confect/core";
import type users from "@repo/backend/confect/_generated/refs/users";

/** The public face of a profile, as the address of the profile reads it. */
export type PublicProfile = NonNullable<
  Ref.Returns<typeof users.queries.getProfileByUsername>
>;

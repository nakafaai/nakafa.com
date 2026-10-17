import { readUsername } from "@repo/backend/confect/users/username";
import { Option, Result, Schema, String as Str } from "effect";
import { PROFILE_SIGN, ProfileTab } from "@/lib/profile/href";

/** Whether the segments below a profile name one of its tabs: none, which is Posts, or one of `ProfileTab`. */
export function isProfileTab(segments: readonly string[]) {
  return (
    segments.length === 0 ||
    (segments.length === 1 && Schema.is(ProfileTab)(segments[0]))
  );
}

/** Reads the username from the first segment of an address, such as `@nabilfatih`. */
export function readProfileRoot(root: string) {
  return Str.startsWith(PROFILE_SIGN)(root)
    ? Result.getSuccess(readUsername(Str.slice(PROFILE_SIGN.length)(root)))
    : Option.none();
}

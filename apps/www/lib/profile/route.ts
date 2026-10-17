import { readUsername } from "@repo/backend/confect/users/username";
import { Option, Result, String as Str } from "effect";
import { PROFILE_SIGN } from "@/lib/profile/href";

/** Whether the segments below a profile name one of its tabs: comments, or `chat`. */
export function isProfileTab(segments: readonly string[]) {
  return (
    segments.length === 0 ||
    (segments.length === 1 &&
      (segments[0] === "comments" || segments[0] === "chat"))
  );
}

/** Reads the username from the first segment of an address, such as `@nabilfatih`. */
export function readProfileRoot(root: string) {
  return Str.startsWith(PROFILE_SIGN)(root)
    ? Result.getSuccess(readUsername(Str.slice(PROFILE_SIGN.length)(root)))
    : Option.none();
}

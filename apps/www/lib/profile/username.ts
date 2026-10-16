import {
  readUsername,
  type UsernameCheck,
} from "@repo/backend/confect/users/username";
import { Option, Result } from "effect";

/** The dictionary key of the sentence that says why a name cannot be taken, or that it can. */
type UsernameMessage =
  | "username-available"
  | "username-characters"
  | "username-letter-first"
  | "username-not-allowed"
  | "username-taken"
  | "username-too-short";

/** The sentence for each answer of the check. A new answer must name its sentence here. */
const MESSAGES = {
  available: "username-available",
  characters: "username-characters",
  letterFirst: "username-letter-first",
  notAllowed: "username-not-allowed",
  taken: "username-taken",
  tooShort: "username-too-short",
} satisfies Record<typeof UsernameCheck.Type, UsernameMessage>;

/**
 * What the username field says about the typed name, and whether Save may run.
 * The check answers the name it was asked, so an answer for older text is not
 * shown: while the typed text and the asked text differ, or the check still
 * runs, the field says nothing and cannot save. The account's own name says
 * nothing and cannot save either, because nothing would change.
 */
export function usernameReply({
  asked,
  check,
  current,
  typed,
}: {
  readonly asked: string;
  readonly check: typeof UsernameCheck.Type | undefined;
  readonly current: string | undefined;
  readonly typed: string;
}) {
  const stored = Option.getOrUndefined(Result.getSuccess(readUsername(typed)));
  if (stored !== undefined && stored === current) {
    return { canSave: false, message: undefined };
  }
  if (asked !== typed || check === undefined) {
    return { canSave: false, message: undefined };
  }
  return { canSave: check === "available", message: MESSAGES[check] };
}

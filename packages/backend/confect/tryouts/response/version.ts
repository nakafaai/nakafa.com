import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import { Option } from "effect";

/**
 * Returns the version of a question's latest admitted write: its stored
 * answer's, or, once that answer was cleared, the version of the clear that its
 * placement keeps. A cleared question therefore still refuses every write
 * that an older one overtook. None before the first versioned write.
 */
export function readVersion(
  placement: Docs["tryoutAttemptPlacements"],
  stored: Option.Option<Docs["tryoutResponses"]>
): Option.Option<Version> {
  return Option.flatMapNullishOr(stored, ({ version }) => version).pipe(
    Option.orElse(() => Option.fromNullishOr(placement.clearedVersion))
  );
}

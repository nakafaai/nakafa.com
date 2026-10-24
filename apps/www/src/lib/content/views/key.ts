import type { LearningContextInput } from "@repo/backend/confect/contents/context";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { Array as Arr } from "effect";

/** Builds the local dedupe key for an engaged content-view attempt. */
export function createContentViewKey({
  authenticated,
  contentId,
  context,
  locale,
  signedInUserId,
}: {
  readonly authenticated: boolean;
  readonly contentId?: string | null;
  readonly context?: LearningContextInput;
  readonly locale: Locale;
  readonly signedInUserId?: string | null;
}) {
  const viewerKey = authenticated
    ? `user:${signedInUserId ?? "pending"}`
    : "anonymous";

  return Arr.join(
    [
      viewerKey,
      locale,
      contentId ?? "untracked",
      context?.mode ?? "canonical",
      context?.programKey ?? "",
      context?.nodeKey ?? "",
    ],
    ":"
  );
}

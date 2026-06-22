import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/** Builds the local dedupe key for one engaged content-view attempt. */
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

  return [
    viewerKey,
    locale,
    contentId ?? "untracked",
    context?.mode ?? "canonical",
    context?.programKey ?? "",
    context?.nodeKey ?? "",
  ].join(":");
}

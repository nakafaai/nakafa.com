import type { Locale } from "@repo/contents/_types/content";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";

/** Derives the stable graph content ID validated again by the view mutation. */
export function getContentViewId(args: { locale: Locale; route: string }) {
  return createLearningGraphIdentityFromRoute(args)?.assetId ?? null;
}

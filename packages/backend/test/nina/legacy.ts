import type {
  NinaPage,
  NinaStoredPageSchema,
} from "@repo/backend/confect/nina/contract/turn";

/** When the old copies of a context were taken: the moment its turn was admitted. */
const CAPTURED_AT = "2026-09-27T12:00:00.000Z";

/**
 * The page of a turn as it was stored before the change that stores only what a
 * turn's readers use, built from the page a turn is written with now. The old
 * code added to it, and nothing else:
 *
 * - the address and the signed state of the page, again beside `nina`;
 * - the asset id again, as `contentId`;
 * - three permission flags that were `true` on every turn;
 * - a second copy of the context (`snapshot`) and a marker (`transition`) in
 *   the pack. A turn admitted from the page it was asked on has the source
 *   `current-page` and the reason `page-context`. Until 11 October 2026 a turn
 *   of a pinned chat had the source `pinned-chat` and the reason
 *   `same-context`, which `pinned` gives.
 *
 * Step two of the change deletes this module with the old shape.
 */
export function oldPage(
  { nina, ...page }: NinaPage,
  { pinned = false }: { readonly pinned?: boolean } = {}
): typeof NinaStoredPageSchema.Type {
  const { learning, placement, tools } = nina;
  const oldLearning =
    learning.assetId === undefined
      ? learning
      : { ...learning, contentId: learning.assetId };
  const oldTools = {
    ...tools,
    allowDeepResearch: true,
    allowMath: true,
    allowNakafa: true,
  };
  return {
    ...page,
    url: learning.url,
    verified: learning.verified,
    nina: {
      ...nina,
      learning: oldLearning,
      tools: oldTools,
      snapshot: {
        capturedAt: CAPTURED_AT,
        learning: oldLearning,
        ...(placement === undefined ? {} : { placement }),
        source: pinned ? "pinned-chat" : "current-page",
        tools: oldTools,
      },
      transition: {
        reason: pinned ? "same-context" : "page-context",
        toContextKey:
          placement === undefined
            ? `canonical:${learning.slug}`
            : `placement:${placement.programKey}:${placement.nodeKey}:${learning.slug}`,
      },
    },
  };
}

/**
 * The copy of the context and the marker that the oldest turns hold on the turn
 * itself, beside their page, from before a turn kept its context in `page`.
 */
export function oldestFields(page: NinaPage) {
  const { snapshot, transition } = oldPage(page).nina;
  return { snapshot, transition };
}

import type {
  NinaPage,
  NinaStoredPageSchema,
} from "@repo/backend/confect/nina/contract/turn";

/** When the old copies of a context were taken: the moment its turn was admitted. */
const CAPTURED_AT = "2026-09-27T12:00:00.000Z";

/**
 * What the old code stored for the page of a turn in its pack: the learning
 * page and the tool policy with the fields the old code added to them, and the
 * copy of the context (`snapshot`) and the marker (`transition`) beside them.
 * A turn admitted from the page it was asked on has the source `current-page`
 * and the reason `page-context`. Until 11 October 2026 a turn of a pinned chat
 * had the source `pinned-chat` and the reason `same-context`, which `pinned`
 * gives.
 */
function oldContext({ nina }: NinaPage, pinned: boolean) {
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
  };
}

/**
 * The page of a turn as it was stored before the change that stores only what a
 * turn's readers use (ADR 0001), built from the page a turn is written with
 * now. The old code added the fields below to it, and nothing else.
 *
 * Step two of the change deletes this module with the old shape.
 */
export function oldPage(
  page: NinaPage,
  { pinned = false }: { readonly pinned?: boolean } = {}
): typeof NinaStoredPageSchema.Type {
  const { nina, ...rest } = page;
  return {
    ...rest,
    url: nina.learning.url,
    verified: nina.learning.verified,
    nina: { ...nina, ...oldContext(page, pinned) },
  };
}

/**
 * What the oldest turns hold on the turn itself, beside their page, from before
 * a turn kept its context in `page`.
 */
export function oldestFields(page: NinaPage) {
  const { snapshot, transition } = oldContext(page, false);
  return { snapshot, transition };
}

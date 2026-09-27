import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
export interface ModelSlots {
  readonly articleSlot: ModelSlot;
  readonly materialSlot: ModelSlot;
  readonly searchSlot: ModelSlot;
}

/** Selects the inactive bounded buffer without mutable naming semantics. */

/** Selects the exact three model buffers owned by publication state. */
export function selectModelSlots(state: Doc<"contentState">): ModelSlots {
  return {
    articleSlot: state.articleSlot,
    materialSlot: state.materialSlot,
    searchSlot: state.searchSlot,
  };
}

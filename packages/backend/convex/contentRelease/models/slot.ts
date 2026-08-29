import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const modelSlotValidator = v.union(
  v.literal("blue"),
  v.literal("green")
);

export type ModelSlot = Infer<typeof modelSlotValidator>;

export const INITIAL_MODEL_SLOT = "blue" satisfies ModelSlot;

export interface ModelSlots {
  readonly articleSlot: ModelSlot;
  readonly materialSlot: ModelSlot;
  readonly searchSlot: ModelSlot;
}

/** Selects the inactive bounded buffer without mutable naming semantics. */
export function alternateModelSlot(slot: ModelSlot): ModelSlot {
  return slot === "blue" ? "green" : "blue";
}

/** Selects the exact three model buffers owned by publication state. */
export function selectModelSlots(state: Doc<"contentState">): ModelSlots {
  return {
    articleSlot: state.articleSlot,
    materialSlot: state.materialSlot,
    searchSlot: state.searchSlot,
  };
}

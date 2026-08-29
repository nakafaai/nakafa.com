import type { Infer } from "convex/values";
import { v } from "convex/values";

export const modelSlotValidator = v.union(
  v.literal("blue"),
  v.literal("green")
);

export type ModelSlot = Infer<typeof modelSlotValidator>;

export const INITIAL_MODEL_SLOT = "blue" satisfies ModelSlot;

/** Selects the inactive bounded buffer without mutable naming semantics. */
export function alternateModelSlot(slot: ModelSlot): ModelSlot {
  return slot === "blue" ? "green" : "blue";
}

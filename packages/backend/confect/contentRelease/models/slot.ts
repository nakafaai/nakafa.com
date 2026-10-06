import { Schema } from "effect";
export const modelSlotValidator = Schema.Union([
  Schema.Literal("blue"),
  Schema.Literal("green"),
]);
export type ModelSlot = typeof modelSlotValidator.Type;
export const INITIAL_MODEL_SLOT = "blue" satisfies ModelSlot;
/** Selects the inactive bounded buffer without mutable naming semantics. */
export function alternateModelSlot(slot: ModelSlot): ModelSlot {
  return slot === "blue" ? "green" : "blue";
}

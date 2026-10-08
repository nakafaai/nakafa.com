import type { Docs } from "@repo/backend/confect/_generated/docs";
import contentStateTable from "@repo/backend/confect/_generated/tables/contentState";
import { Struct } from "effect";

const ModelSlotsSchema = contentStateTable.Fields.mapFields(
  Struct.pick(["articleSlot", "materialSlot", "searchSlot"])
);
export type ModelSlots = typeof ModelSlotsSchema.Type;

/** Selects the exact three model buffers owned by publication state. */
export function selectModelSlots(state: Docs["contentState"]): ModelSlots {
  return {
    articleSlot: state.articleSlot,
    materialSlot: state.materialSlot,
    searchSlot: state.searchSlot,
  };
}

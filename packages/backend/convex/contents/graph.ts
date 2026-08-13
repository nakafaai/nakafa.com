import { v } from "convex/values";

/** Convex validator for graph identity persisted on content read models. */
export const learningGraphIdentityValidator = v.object({
  alignmentId: v.string(),
  assetId: v.string(),
  conceptId: v.string(),
  learningObjectId: v.string(),
  lensId: v.string(),
});

/** Convex validator for persisted graph content IDs. */
export const graphContentIdValidator =
  learningGraphIdentityValidator.fields.assetId;

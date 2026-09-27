import { Schema } from "effect";
/** Convex validator for graph identity persisted on content read models. */
export const learningGraphIdentityValidator = Schema.Struct({
  alignmentId: Schema.String,
  assetId: Schema.String,
  conceptId: Schema.String,
  learningObjectId: Schema.String,
  lensId: Schema.String,
});

/** Convex validator for persisted graph content IDs. */
export const graphContentIdValidator =
  learningGraphIdentityValidator.fields.assetId;

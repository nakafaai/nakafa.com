import {
  createLearningGraphIdentityFromRoute,
  getLearningGraphIdentity,
  type LearningGraphSource,
} from "@repo/contents/_types/learning-graph";
import { ConvexError, v } from "convex/values";

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

/** Builds canonical graph identity for one synced content route projection. */
export function getContentGraphIdentity(source: LearningGraphSource) {
  const identity = getLearningGraphIdentity(source);

  if (identity) {
    return identity;
  }

  throw new ConvexError({
    code: "CONTENT_GRAPH_IDENTITY_INVALID_SOURCE",
    message: "Content source cannot be projected into graph identity.",
  });
}

/** Builds graph identity from a public route projection when supported. */
export function getContentGraphIdentityFromRoute(
  source: Omit<LearningGraphSource, "kind">
) {
  return createLearningGraphIdentityFromRoute(source);
}

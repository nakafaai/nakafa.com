import {
  createLearningGraphIdentity,
  createLearningGraphIdentityFromRoute,
  type LearningGraphSource,
} from "@repo/contents/_types/learning-graph";
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

/** Builds canonical graph identity for one synced content route projection. */
export function getContentGraphIdentity(source: LearningGraphSource) {
  return createLearningGraphIdentity(source);
}

/** Builds graph identity from a public route projection when supported. */
export function getContentGraphIdentityFromRoute(
  source: Omit<LearningGraphSource, "kind">
) {
  return createLearningGraphIdentityFromRoute(source);
}

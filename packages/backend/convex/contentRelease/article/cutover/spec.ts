import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Maximum article rows owned by the one-time atomic date cutover. */
export const ARTICLE_DATE_CUTOVER_LIMIT = EXACT_SCOPE_LIMIT;

/** Exact active publication identity required by every cutover operation. */
export const articleDateCutoverRequestValidator = v.object({
  expectedManifestHash: v.string(),
  expectedReleaseId: v.string(),
  expectedSequence: v.number(),
});
export type ArticleDateCutoverRequest = Infer<
  typeof articleDateCutoverRequestValidator
>;

const articleDateCutoverIdentityValidator = v.object({
  manifestHash: v.string(),
  releaseId: v.string(),
  sequence: v.number(),
});
export type ArticleDateCutoverIdentity = Infer<
  typeof articleDateCutoverIdentityValidator
>;

const articleDateCutoverCountsValidator = v.object({
  currentOnly: v.number(),
  dual: v.number(),
  legacyOnly: v.number(),
  total: v.number(),
});
export type ArticleDateCutoverCounts = Infer<
  typeof articleDateCutoverCountsValidator
>;

/** Server-derived article storage state for the selected publication. */
export const articleDateCutoverStatusValidator = v.object({
  active: articleDateCutoverIdentityValidator,
  counts: articleDateCutoverCountsValidator,
});
export type ArticleDateCutoverStatus = Infer<
  typeof articleDateCutoverStatusValidator
>;

/** Atomic mutation receipt retained by the external rollout record. */
export const articleDateCutoverReceiptValidator =
  articleDateCutoverStatusValidator.extend({
    changed: v.number(),
    executedAt: v.number(),
    operation: literals("remove", "restore"),
    unchanged: v.number(),
  });
export type ArticleDateCutoverReceipt = Infer<
  typeof articleDateCutoverReceiptValidator
>;

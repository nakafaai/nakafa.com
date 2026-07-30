import { localeValidator } from "@repo/backend/convex/contentRelease/spec";
import { type Infer, v } from "convex/values";

/** Public material identity accepted by the agent content reader. */
export const materialLookupInputValidator = v.union(
  v.object({
    contentId: v.string(),
    kind: v.literal("content"),
  }),
  v.object({
    kind: v.literal("route"),
    locale: localeValidator,
    publicPath: v.string(),
  })
);

export type MaterialLookupInput = Infer<typeof materialLookupInputValidator>;

/** Source identity sent for one bounded material-shell reconciliation. */
export const materialSourceCandidateValidator = v.object({
  contentKey: v.string(),
  locale: localeValidator,
  parentPath: v.optional(v.string()),
});

export type MaterialSourceCandidate = Infer<
  typeof materialSourceCandidateValidator
>;

/** Exact active ownership result for one source-shell identity. */
export const materialSourceClaimValidator = v.union(
  v.object({
    contentKey: v.string(),
    kind: v.literal("missing"),
    locale: localeValidator,
  }),
  v.object({
    contentKey: v.string(),
    kind: v.literal("found"),
    locale: localeValidator,
    projectionJson: v.string(),
  })
);

export type MaterialSourceClaim = Infer<typeof materialSourceClaimValidator>;

import { localeValidator } from "@repo/backend/convex/contentRelease/spec";
import { type Infer, v } from "convex/values";

/** Source identity sent for one bounded material-shell reconciliation. */
export const materialSourceCandidateValidator = v.object({
  contentKey: v.string(),
  locale: localeValidator,
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

import { localeValidator } from "@repo/backend/convex/contentRelease/spec";
import { apiContentItemValidator } from "@repo/backend/convex/contents/runtime/spec";
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

/** One source or signed-publication row selected for the partner API. */
export const materialApiEntryValidator = v.union(
  v.object({
    item: apiContentItemValidator,
    kind: v.literal("source"),
  }),
  v.object({
    kind: v.literal("published"),
    locale: localeValidator,
    publicPath: v.string(),
  })
);

/** Bounded material partner page selected in one Convex transaction. */
export const materialApiPageValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(materialApiEntryValidator),
});

/** Active exact-ownership decision for one graph-backed material ID. */
export const materialApiRouteValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  route: v.union(
    v.null(),
    v.object({
      locale: localeValidator,
      publicPath: v.string(),
    })
  ),
  syncedAt: v.union(v.number(), v.null()),
});

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

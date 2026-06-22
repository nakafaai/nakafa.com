import {
  NINA_CONTEXT_SOURCES,
  NINA_CONTEXT_TRANSITION_REASONS,
} from "@repo/ai/nina/context";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const ninaContextSourceValidator = literals(...NINA_CONTEXT_SOURCES);
const ninaContextTransitionReasonValidator = literals(
  ...NINA_CONTEXT_TRANSITION_REASONS
);

/** Convex validator for the page identity stored in Nina message snapshots. */
export const ninaLearningContextValidator = v.object({
  assetId: v.optional(v.string()),
  contentId: v.optional(v.string()),
  locale: localeValidator,
  materialKey: v.optional(v.string()),
  section: v.optional(v.string()),
  slug: v.string(),
  sourcePath: v.optional(v.string()),
  title: v.optional(v.string()),
  url: v.string(),
  verified: v.boolean(),
});

/** Convex validator for verified placement context carried by Nina messages. */
export const ninaPlacementContextValidator = v.object({
  mode: v.literal("placement"),
  nodeKey: v.string(),
  parentHref: v.string(),
  parentTitle: v.string(),
  programKey: v.string(),
});

/** Convex validator for specialist permissions captured with a Nina turn. */
export const ninaToolContextValidator = v.object({
  allowDeepResearch: v.boolean(),
  allowMath: v.boolean(),
  allowNakafa: v.boolean(),
  allowPageFetch: v.boolean(),
  evidenceScope: v.union(
    v.literal("verified-page"),
    v.literal("general-learning")
  ),
});

/** Convex validator for the compact Nina context snapshot on chat messages. */
export const ninaContextSnapshotValidator = v.object({
  capturedAt: v.string(),
  learning: ninaLearningContextValidator,
  placement: v.optional(ninaPlacementContextValidator),
  source: ninaContextSourceValidator,
  tools: ninaToolContextValidator,
});

/** Convex validator for explicit Nina context transition metadata. */
export const ninaContextTransitionValidator = v.object({
  fromContextKey: v.optional(v.string()),
  reason: ninaContextTransitionReasonValidator,
  toContextKey: v.string(),
});

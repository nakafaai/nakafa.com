import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import {
  NINA_CONTEXT_SOURCES,
  NINA_CONTEXT_TRANSITION_REASONS,
} from "@repo/backend/confect/nina/memory/pack";
import { Schema } from "effect";

const ninaContextSourceValidator = Schema.Literals([...NINA_CONTEXT_SOURCES]);
const ninaContextTransitionReasonValidator = Schema.Literals([
  ...NINA_CONTEXT_TRANSITION_REASONS,
]);

/** Convex validator for the page identity stored in Nina message snapshots. */
export const ninaLearningContextValidator = Schema.Struct({
  assetId: Schema.optionalKey(Schema.String),
  contentId: Schema.optionalKey(Schema.String),
  locale: localeValidator,
  materialKey: Schema.optionalKey(Schema.String),
  section: Schema.optionalKey(Schema.String),
  slug: Schema.String,
  sourcePath: Schema.optionalKey(Schema.String),
  title: Schema.optionalKey(Schema.String),
  url: Schema.String,
  verified: Schema.Boolean,
});

/** Convex validator for verified placement context carried by Nina messages. */
export const ninaPlacementContextValidator = Schema.Struct({
  mode: Schema.Literal("placement"),
  nodeKey: Schema.String,
  parentHref: Schema.String,
  parentTitle: Schema.String,
  programKey: Schema.String,
});

/** Convex validator for specialist permissions captured with a Nina turn. */
export const ninaToolContextValidator = Schema.Struct({
  allowDeepResearch: Schema.Boolean,
  allowMath: Schema.Boolean,
  allowNakafa: Schema.Boolean,
  allowPageFetch: Schema.Boolean,
  evidenceScope: Schema.Union([
    Schema.Literal("verified-page"),
    Schema.Literal("general-learning"),
  ]),
});

/** Convex validator for the compact Nina context snapshot on chat messages. */
export const ninaContextSnapshotValidator = Schema.Struct({
  capturedAt: Schema.String,
  learning: ninaLearningContextValidator,
  placement: Schema.optionalKey(ninaPlacementContextValidator),
  source: ninaContextSourceValidator,
  tools: ninaToolContextValidator,
});

/** Convex validator for explicit Nina context transition metadata. */
export const ninaContextTransitionValidator = Schema.Struct({
  fromContextKey: Schema.optionalKey(Schema.String),
  reason: ninaContextTransitionReasonValidator,
  toContextKey: Schema.String,
});

import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { NinaFocusSchema } from "@repo/backend/confect/nina/contract/focus";
import { LocaleSchema } from "@repo/contents/content";
import { Effect, Schema, Struct } from "effect";

/** Page identity Nina can trust because the app validated it before the turn. */
const NinaLearningContextSchema = Schema.Struct({
  assetId: Schema.optionalKey(Schema.String),
  locale: LocaleSchema,
  materialKey: Schema.optionalKey(Schema.String),
  section: Schema.optionalKey(Schema.String),
  slug: Schema.String,
  sourcePath: Schema.optionalKey(Schema.String),
  title: Schema.optionalKey(Schema.String),
  url: Schema.String,
  verified: Schema.Boolean,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Verified placement that explains why this asset was opened from navigation. */
const LearningPlacementContextSchema = Schema.Struct({
  mode: Schema.Literal("placement"),
  nodeKey: Schema.String,
  parentHref: Schema.String,
  parentTitle: Schema.String,
  programKey: LearningProgramKeySchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/**
 * What the model is told about the evidence of a turn: whether the signed
 * content of the page is given to it, and the scope that evidence has. Both
 * follow from whether the page is verified.
 */
const NinaToolContextSchema = Schema.Struct({
  allowPageFetch: Schema.Boolean,
  evidenceScope: Schema.Literals(["verified-page", "general-learning"]),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Validated learning context of the page a learner is on before one Nina turn. */
const NinaLearningSessionInputSchema = Schema.Struct({
  focus: Schema.optionalKey(NinaFocusSchema),
  learning: NinaLearningContextSchema,
  placement: Schema.optionalKey(LearningPlacementContextSchema),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
type NinaLearningContext = typeof NinaLearningContextSchema.Type;
type NinaToolContext = typeof NinaToolContextSchema.Type;
/** What a turn knows about its page: stored with the turn and printed in its prompt. */
export const NinaContextPackSchema = Schema.Struct({
  focus: Schema.optionalKey(NinaFocusSchema),
  learning: NinaLearningContextSchema,
  placement: Schema.optionalKey(LearningPlacementContextSchema),
  tools: NinaToolContextSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type NinaContextPack = typeof NinaContextPackSchema.Type;
/** Learning context persisted with one Nina turn. */
const NinaLearningSessionSchema = Schema.Struct({
  context: NinaContextPackSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
type NinaLearningSession = typeof NinaLearningSessionSchema.Type;
/** Raised when the app boundary sends an invalid Nina learning context. */
class NinaContextError extends Schema.TaggedError<NinaContextError>()(
  "NinaContextError",
  {
    message: Schema.String,
  }
) {}
/** Resolves the evidence the model is told about from validated context. */
function resolveNinaToolContext(
  learning: NinaLearningContext
): NinaToolContext {
  const allowPageFetch = learning.verified;
  return {
    allowPageFetch,
    evidenceScope: allowPageFetch ? "verified-page" : "general-learning",
  };
}
/** Opens one validated Nina learning session as an Effect-native program. */
export const openNinaLearningSession = Effect.fn(
  "nina.openNinaLearningSession"
)(function* (input: unknown) {
  const sessionInput = yield* Schema.decodeUnknownEffect(
    NinaLearningSessionInputSchema
  )(input).pipe(
    Effect.mapError(
      () =>
        new NinaContextError({
          message: "Invalid Nina learning session input.",
        })
    )
  );
  return {
    context: {
      learning: sessionInput.learning,
      ...Struct.pick(sessionInput, ["focus", "placement"]),
      tools: resolveNinaToolContext(sessionInput.learning),
    },
  } satisfies NinaLearningSession;
});

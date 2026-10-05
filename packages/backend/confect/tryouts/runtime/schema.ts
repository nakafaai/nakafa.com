import { TryoutMarksSchema } from "@nakafa/aksara-contracts/tryout/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";
export const tryoutSectionSnapshotValidator = Schema.Struct({
  /** Signed marks that score this section of a penalized set. */
  marks: Schema.optionalKey(TryoutMarksSchema),
  publicPath: Schema.optionalKey(Schema.String),
  questionCount: Schema.Finite,
  questionSourcePath: Schema.String,
  sectionIdentity: Schema.String,
  sectionKey: tryoutRouteKeyValidator,
  sectionOrder: Schema.Finite,
  sectionRowHash: Schema.String,
  sourceRevision: Schema.String,
  timeLimitSeconds: Schema.Finite,
});

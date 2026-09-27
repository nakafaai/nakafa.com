import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";
export const tryoutSectionSnapshotValidator = Schema.Struct({
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

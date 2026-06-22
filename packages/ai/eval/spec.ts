import { Schema } from "effect";

/** Stable deterministic eval targets required for Nina readiness. */
export const EvalTargetSchema = Schema.Literal(
  "math",
  "nakafa",
  "research",
  "trace",
  "turn"
);

/** One text expectation checked against a deterministic eval rendering. */
export class EvalExpectation extends Schema.Class<EvalExpectation>(
  "EvalExpectation"
)({
  includes: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
}) {}

/** Schema-owned deterministic eval case for NinaHarness and capabilities. */
export class EvalCase extends Schema.Class<EvalCase>("EvalCase")({
  expectations: Schema.Array(EvalExpectation).pipe(Schema.mutable),
  id: Schema.NonEmptyString,
  target: EvalTargetSchema,
}) {}

/** Schema-owned collection of deterministic eval cases. */
export class EvalSuite extends Schema.Class<EvalSuite>("EvalSuite")({
  cases: Schema.Array(EvalCase).pipe(Schema.mutable),
  name: Schema.NonEmptyString,
}) {}

/** Outcome for one deterministic eval case. */
export class EvalCaseResult extends Schema.Class<EvalCaseResult>(
  "EvalCaseResult"
)({
  id: Schema.NonEmptyString,
  missing: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
  status: Schema.Literal("passed", "failed"),
}) {}

/** Schema-owned record for one deterministic eval suite execution. */
export class EvalRun extends Schema.Class<EvalRun>("EvalRun")({
  endedAt: Schema.Number,
  results: Schema.Array(EvalCaseResult).pipe(Schema.mutable),
  startedAt: Schema.Number,
  suite: Schema.NonEmptyString,
}) {}

/** Expected eval rendering or assertion failure. */
export class EvalRunError extends Schema.TaggedError<EvalRunError>()(
  "EvalRunError",
  {
    caseId: Schema.String,
    message: Schema.String,
  }
) {}

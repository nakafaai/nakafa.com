import { FunctionSpec, GroupSpec } from "@confect/core";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import { Schema } from "effect";

/** Texts one measuring call may ask about. A labelled set goes up in calls of this size. */
export const MEASURE_TEXT_LIMIT = 30;

/**
 * The judgments to measure, the texts to measure them on, and how many texts
 * share one request. The measuring command encodes its arguments with this
 * contract, and the function declares its arguments from it.
 */
export const measureInputValidator = Schema.Struct({
  names: Schema.mutable(Schema.NonEmptyArray(JudgmentName)),
  texts: Schema.mutable(Schema.Array(Schema.String)).check(
    Schema.isMaxLength(MEASURE_TEXT_LIMIT)
  ),
  together: Schema.Int.check(
    Schema.isBetween({ maximum: MEASURE_TEXT_LIMIT, minimum: 1 })
  ),
});

/**
 * What a measuring call found for one text: the probability that each asked
 * judgment gives, by the name of the judgment, or the routing facts of the
 * failure that kept the text from getting them.
 */
const Measured = Schema.Union([
  Schema.Struct({
    probabilities: Schema.Record(Schema.String, Schema.Finite),
  }),
  Schema.Struct({
    failure: Schema.Struct({
      reason: Schema.String,
      status: Schema.optionalKey(Schema.Finite),
      type: Schema.optionalKey(Schema.String),
    }),
  }),
]);

/** The measurement of a call: one entry for each text, and the threshold each asked judgment has on the deployment. */
export const Measurement = Schema.Struct({
  kind: Schema.Literal("measured"),
  rows: Schema.mutable(Schema.Array(Measured)),
  thresholds: Schema.Record(Schema.String, Schema.Finite),
});

/**
 * The measurement of a call, or `failed` with the failure that ended it: the
 * deployment cannot reach the gateway. A request that the gateway refuses is
 * not that failure but a row of the measurement.
 *
 * A failure is an answer and not a failure of the call, because the Convex CLI
 * that runs the measuring command prints a failed call as text and drops the
 * typed data of its error, so the reason would not reach the report.
 */
export const measureResultValidator = Schema.Union([
  Measurement,
  Schema.Struct({
    failure: GatewayConfigurationError,
    kind: Schema.Literal("failed"),
  }),
]);

export default GroupSpec.make().addFunction(
  // Runs the named judgments on some texts and returns their probabilities, so
  // that the thresholds of `judgment/catalog` can be set from a labelled set.
  // `together` texts share a request, and every named judgment is asked about
  // them in that one request, as production asks them. It is internal, and only
  // the `judgment:measure` command calls it, on the dev deployment of a
  // checkout. It sends only the texts it is given.
  FunctionSpec.internalAction({
    name: "measure",
    args: () => measureInputValidator.fields,
    returns: () => measureResultValidator,
  })
);

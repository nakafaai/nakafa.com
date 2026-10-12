import { FunctionSpec, GroupSpec } from "@confect/core";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import { Schema } from "effect";

/** Texts one measuring call may ask about. A labelled set goes up in calls of this size. */
export const MEASURE_TEXT_LIMIT = 30;

/**
 * The judgments to measure and the texts to measure them on. Each text is a
 * request of its own, as production asks it. The measuring command encodes its
 * arguments with this contract, and the function declares its arguments from it.
 */
export const measureInputValidator = Schema.Struct({
  names: Schema.mutable(Schema.NonEmptyArray(JudgmentName)),
  texts: Schema.mutable(Schema.Array(Schema.String)).check(
    Schema.isMaxLength(MEASURE_TEXT_LIMIT)
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

/**
 * The entry of the catalog that one judgment held when the call ran: the
 * instructions the decision model read and the probability from which the
 * judgment counts as yes.
 */
const Held = Schema.Struct({
  instructions: Schema.String,
  threshold: Schema.Finite,
});

/**
 * The measurement of a call: one entry for each text, and the entry of the
 * catalog that each asked judgment has on the deployment. A run of several
 * calls compares these entries, so that a deploy in the middle of a run does
 * not mix two versions of a judgment into one table.
 */
export const Measurement = Schema.Struct({
  judgments: Schema.Record(Schema.String, Held),
  kind: Schema.Literal("measured"),
  rows: Schema.mutable(Schema.Array(Measured)),
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
  // Each text is a request of its own, and every named judgment is asked about
  // it in that one request, as production asks them. It is internal, and only
  // the `judgment:measure` command calls it, on the dev deployment of a
  // checkout. It sends only the texts it is given.
  FunctionSpec.internalAction({
    name: "measure",
    args: () => measureInputValidator.fields,
    returns: () => measureResultValidator,
  })
);

import { FunctionSpec, GroupSpec } from "@confect/core";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { Schema } from "effect";

/** Texts one measuring call may ask about. A labelled set goes up in calls of this size. */
export const MEASURE_TEXT_LIMIT = 30;

/** The most texts that may share one request when a run measures them together. */
export const MEASURE_TOGETHER_LIMIT = 8;

/**
 * What a measuring call found for one text: the probability that each
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

/** The answer of a measuring call: one entry for each text, and the threshold each judgment has on the deployment. */
export const Measurement = Schema.Struct({
  rows: Schema.mutable(Schema.Array(Measured)),
  thresholds: Schema.Record(Schema.String, Schema.Finite),
});

export default GroupSpec.make().addFunction(
  // Runs the judgments on some texts and returns their probabilities, so that
  // the thresholds of `judgment/catalog` can be set from a labelled set. It is
  // internal, and only the `judgment:measure` command calls it, on a deployment
  // its caller names. It sends only the texts it is given.
  FunctionSpec.internalAction({
    name: "measure",
    args: () => ({
      texts: Schema.mutable(Schema.Array(Schema.String)).check(
        Schema.isMaxLength(MEASURE_TEXT_LIMIT)
      ),
      together: Schema.Int.check(
        Schema.isBetween({ maximum: MEASURE_TOGETHER_LIMIT, minimum: 1 })
      ),
    }),
    returns: () => Measurement,
    error: () => GatewayConfigurationError,
  })
);

import { FunctionSpec, GroupSpec } from "@confect/core";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import { Schema } from "effect";

/** Texts one measuring call may ask about. A labelled set goes up in calls of this size. */
export const MEASURE_TEXT_LIMIT = 30;

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

/** The answer of a measuring call: one entry for each text, and the threshold each asked judgment has on the deployment. */
export const Measurement = Schema.Struct({
  rows: Schema.mutable(Schema.Array(Measured)),
  thresholds: Schema.Record(Schema.String, Schema.Finite),
});

export default GroupSpec.make().addFunction(
  // Runs the named judgments on some texts and returns their probabilities, so
  // that the thresholds of `judgment/catalog` can be set from a labelled set.
  // `together` texts share a request, and every named judgment is asked about
  // them in that one request, as production asks them. It is internal, and only
  // the `judgment:measure` command calls it, on a deployment its caller names.
  // It sends only the texts it is given.
  FunctionSpec.internalAction({
    name: "measure",
    args: () => ({
      names: Schema.mutable(Schema.NonEmptyArray(JudgmentName)),
      texts: Schema.mutable(Schema.Array(Schema.String)).check(
        Schema.isMaxLength(MEASURE_TEXT_LIMIT)
      ),
      together: Schema.Int.check(
        Schema.isBetween({ maximum: MEASURE_TEXT_LIMIT, minimum: 1 })
      ),
    }),
    returns: () => Measurement,
    error: () => GatewayConfigurationError,
  })
);

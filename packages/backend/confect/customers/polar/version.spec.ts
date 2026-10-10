import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** What one webhook endpoint sent before the call and sends after it. Never its secret. */
const PolarWebhookVersionChange = Schema.Struct({
  after: Schema.String,
  before: Schema.String,
  id: Schema.String,
});

/**
 * Temporary maintenance function. Polar sends each webhook endpoint the
 * payload version that the endpoint is set to, and removes a version about
 * nine months after it appears. It moves every endpoint of the organization
 * to the version this backend reads, and it is deleted once dev and
 * production report that version.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalAction({
    name: "setWebhookVersion",
    args: () => ({}),
    returns: () => Schema.Array(PolarWebhookVersionChange),
  })
);

import { Effect, Schema } from "effect";
import {
  actionExpression,
  decodeQueuePolicy,
  requireQueueExact,
  requireQueueFingerprint,
} from "./guard.ts";

const StepList = Schema.Array(Schema.Record(Schema.String, Schema.Unknown));
const REQUIRED_FINGERPRINT =
  "d96e9325fe488ee543de95ac1a7cbdd45afda124ffba32fd0ff8fc86a3bbfef1";

/** Validates the protected Required aggregation job and decision program. */
export const validateRequiredJob = Effect.fn("GithubQueue.required")(function* (
  required: Readonly<Record<string, unknown>>
) {
  yield* requireQueueExact(
    Object.keys(required).sort(),
    [
      "env",
      "if",
      "name",
      "needs",
      "runs-on",
      "steps",
      "timeout-minutes",
    ].sort(),
    "Required has unreviewed configuration."
  );
  yield* requireQueueExact(
    {
      env: required.env,
      if: required.if,
      name: required.name,
      needs: required.needs,
      runner: required["runs-on"],
      timeout: required["timeout-minutes"],
    },
    {
      env: {
        PRODUCTION_RESULT: actionExpression("needs.production.result"),
        PRODUCTION_REQUIRED: actionExpression(
          "needs.production-scope.outputs.required"
        ),
        PRODUCTION_SCOPE_RESULT: actionExpression(
          "needs.production-scope.result"
        ),
        QUALITY_RESULT: actionExpression("needs.quality.result"),
        TRUSTED_CONTENT_ENVIRONMENT: actionExpression(
          "needs.production-scope.outputs.trusted"
        ),
      },
      if: "always()",
      name: "Required",
      needs: ["production-scope", "quality", "production"],
      runner: "ubuntu-latest",
      timeout: 2,
    },
    "Required changed its acceptance dependencies."
  );
  const steps = yield* decodeQueuePolicy(StepList, required.steps);
  yield* requireQueueExact(
    steps.length,
    1,
    "Required must contain one reviewed decision step."
  );
  const step = steps[0] ?? {};
  yield* requireQueueExact(
    Object.keys(step).sort(),
    ["name", "run"],
    "Required has an unreviewed decision step."
  );
  yield* requireQueueExact(
    step.name,
    "Verify acceptance jobs",
    "Required changed its decision step."
  );
  yield* requireQueueFingerprint(
    step.run,
    REQUIRED_FINGERPRINT,
    "Required acceptance aggregation"
  );
});

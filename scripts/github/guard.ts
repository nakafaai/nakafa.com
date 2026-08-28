import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Effect, Schema } from "effect";

/** Expected failure while reading or validating merge-queue policy. */
export class GithubQueuePolicyError extends Schema.TaggedError<GithubQueuePolicyError>()(
  "GithubQueuePolicyError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Produces one GitHub expression without embedding parser-significant braces. */
export function actionExpression(expression: string) {
  return ["$", "{{ ", expression, " }}"].join("");
}

/** Creates the typed failure shared by queue policy capabilities. */
export function queuePolicyError(message: string, cause: unknown) {
  return new GithubQueuePolicyError({ cause, message });
}

/** Requires one queue policy condition to remain true. */
export function requireQueuePolicy(
  condition: boolean,
  message: string,
  cause: unknown
) {
  return condition
    ? Effect.void
    : Effect.fail(queuePolicyError(message, cause));
}

/** Requires exact structural equality for a reviewed queue contract. */
export function requireQueueExact(
  actual: unknown,
  expected: unknown,
  message: string
) {
  return requireQueuePolicy(
    isDeepStrictEqual(actual, expected),
    message,
    actual
  );
}

/** Requires an embedded queue program to match its complete reviewed body. */
export function requireQueueFingerprint(
  actual: unknown,
  expected: string,
  capability: string
) {
  const fingerprint =
    typeof actual === "string"
      ? createHash("sha256").update(actual).digest("hex")
      : undefined;
  return requireQueuePolicy(
    fingerprint === expected,
    `${capability} does not match its reviewed fingerprint.`,
    fingerprint
  );
}

/** Decodes one queue contract and rejects every excess property. */
export function decodeQueuePolicy<S extends Schema.Constraint>(
  schema: S,
  value: unknown
) {
  return Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(
    value
  ).pipe(
    Effect.mapError((cause) =>
      queuePolicyError("The merge-queue workflow has an invalid shape.", cause)
    )
  );
}

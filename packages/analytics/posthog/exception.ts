import { Schema } from "effect";

const shortTextSchema = Schema.String.check(Schema.isMaxLength(128));
const identityTextSchema = Schema.String.check(Schema.isMaxLength(512));
const componentStackSchema = Schema.String.check(Schema.isMaxLength(4096));
const sourceSchema = Schema.Trimmed.check(Schema.isNonEmpty()).pipe(
  Schema.check(Schema.isMaxLength(128))
);

/** Exact minimized context admitted with an operational exception. */
export const OperationalExceptionPropertiesSchema = Schema.Struct({
  component: Schema.optional(shortTextSchema),
  component_stack: Schema.optional(Schema.NullOr(componentStackSchema)),
  contentId: Schema.optional(identityTextSchema),
  contextMode: Schema.optional(shortTextSchema),
  convex_error_code: Schema.optional(shortTextSchema),
  cookie_name: Schema.optional(shortTextSchema),
  countryKey: Schema.optional(shortTextSchema),
  error_digest: Schema.optional(identityTextSchema),
  error_location: Schema.optional(shortTextSchema),
  error_name: Schema.optional(shortTextSchema),
  gateway_error_type: Schema.optional(shortTextSchema),
  gateway_model_id: Schema.optional(identityTextSchema),
  gateway_retryable: Schema.optional(Schema.Boolean),
  gateway_status_code: Schema.optional(Schema.Finite),
  has_cached_svg: Schema.optional(Schema.Boolean),
  language: Schema.optional(shortTextSchema),
  locale: Schema.optional(shortTextSchema),
  method: Schema.optional(shortTextSchema),
  model_id: Schema.optional(shortTextSchema),
  nextjs_digest: Schema.optional(identityTextSchema),
  operation: Schema.optional(shortTextSchema),
  programKey: Schema.optional(identityTextSchema),
  render_source: Schema.optional(shortTextSchema),
  revalidate_reason: Schema.optional(shortTextSchema),
  route_path: Schema.optional(identityTextSchema),
  route_type: Schema.optional(shortTextSchema),
  router_kind: Schema.optional(shortTextSchema),
  source: sourceSchema,
  surahNumber: Schema.optional(Schema.Finite),
  verseNumber: Schema.optional(Schema.Finite),
});

export type OperationalExceptionProperties = Schema.Schema.Type<
  typeof OperationalExceptionPropertiesSchema
>;

/** Rejects excess, malformed, or unbounded operational context. */
export function decodeOperationalExceptionProperties(properties: unknown) {
  return Schema.decodeUnknownOption(OperationalExceptionPropertiesSchema)(
    properties,
    { onExcessProperty: "error" }
  );
}

const operationalExceptionMessage = "Operational exception";
const operationalExceptionName = "OperationalError";
const stackFramePattern = /^\s*at\s/;
// Admits only a bounded code identifier, so a message-shaped `name` (spaces,
// an email address) never survives as the retained error class.
const errorClassPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const fingerprintSeparator = "|";
const issueNameSeparator = " · ";
const issueNameMaxLength = 200;
// Bounded context that stays stable across a rebuild, so grouping no longer
// depends on minified stack frames that change on every build.
const fingerprintPropertyKeys = [
  "source",
  "route_path",
  "render_source",
  "error_digest",
  "nextjs_digest",
] as const;
const issueNamePropertyKeys = new Set<string>(["source", "route_path"]);

/** Returns the error class name when it is a safe, bounded identifier. */
function getOperationalExceptionClass(error: unknown) {
  if (error instanceof Error && errorClassPattern.test(error.name)) {
    return error.name;
  }
  return operationalExceptionName;
}

/** Removes messages, causes, and arbitrary payloads while retaining code frames. */
export function createOperationalException(error: unknown) {
  const name = getOperationalExceptionClass(error);
  const operationalError = new Error(operationalExceptionMessage);
  operationalError.name = name;

  if (!(error instanceof Error && error.stack)) {
    return operationalError;
  }

  const frames = error.stack
    .split("\n")
    .filter((line) => stackFramePattern.test(line));
  operationalError.stack = [
    `${name}: ${operationalExceptionMessage}`,
    ...frames,
  ].join("\n");
  return operationalError;
}

/**
 * Builds bounded grouping metadata for one operational exception.
 *
 * The fingerprint and issue name come only from the retained error class
 * (`createOperationalException` already resolved it into the exception name) and
 * the allowed context, so the same fault groups into one issue across rebuilds
 * and reads with a real title instead of the shared constant.
 *
 * Docs:
 * https://posthog.com/docs/error-tracking/fingerprints
 * https://posthog.com/docs/error-tracking/capture#customizing-exception-capture
 */
export function createOperationalExceptionMetadata(
  errorName: string,
  properties: OperationalExceptionProperties
) {
  const fingerprintParts = [errorName];
  const issueNameParts = [errorName];
  for (const key of fingerprintPropertyKeys) {
    const value = properties[key];
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }
    fingerprintParts.push(`${key}:${value}`);
    if (issueNamePropertyKeys.has(key)) {
      issueNameParts.push(value);
    }
  }

  return {
    $exception_fingerprint: fingerprintParts.join(fingerprintSeparator),
    $issue_name: issueNameParts
      .join(issueNameSeparator)
      .slice(0, issueNameMaxLength),
    error_name: errorName,
  };
}

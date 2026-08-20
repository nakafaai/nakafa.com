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

/** Removes messages, causes, and arbitrary payloads while retaining code frames. */
export function createOperationalException(error: unknown) {
  const operationalError = new Error(operationalExceptionMessage);
  operationalError.name = operationalExceptionName;

  if (!(error instanceof Error && error.stack)) {
    return operationalError;
  }

  const frames = error.stack
    .split("\n")
    .filter((line) => stackFramePattern.test(line));
  operationalError.stack = [
    `${operationalExceptionName}: ${operationalExceptionMessage}`,
    ...frames,
  ].join("\n");
  return operationalError;
}

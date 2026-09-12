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
  error_code: Schema.optional(shortTextSchema),
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
const maxDiscriminatorLength = 128;

/** Reads the original error name as a bounded, message-free discriminator. */
function readErrorName(error: unknown) {
  if (!(error instanceof Error)) {
    return;
  }
  const name = error.name.trim();
  if (!name) {
    return;
  }
  return name.slice(0, maxDiscriminatorLength);
}

/** Reads a bounded error code when the error carries a string one. */
function readErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return;
  }
  const { code } = error as { code: unknown };
  if (typeof code !== "string") {
    return;
  }
  const trimmed = code.trim();
  return trimmed ? trimmed.slice(0, maxDiscriminatorLength) : undefined;
}

/** Safe, message-free discriminators recorded beside a redacted exception. */
export function operationalExceptionDiscriminators(error: unknown) {
  const name = readErrorName(error);
  const code = readErrorCode(error);
  return {
    ...(name === undefined ? {} : { error_name: name }),
    ...(code === undefined ? {} : { error_code: code }),
  } satisfies Partial<OperationalExceptionProperties>;
}

/** Removes messages, causes, and arbitrary payloads while retaining code frames. */
export function createOperationalException(error: unknown) {
  const name = readErrorName(error) ?? operationalExceptionName;
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

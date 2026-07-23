import { Schema } from "effect";

/** A loopback preview request failed before trusted JSON was available. */
export class PreviewRequestError extends Schema.TaggedError<PreviewRequestError>()(
  "PreviewRequestError",
  {
    stage: Schema.Literal("connect", "response", "body"),
    status: Schema.optional(Schema.Number.pipe(Schema.int())),
  }
) {}

/** A loopback response exceeded its route-specific byte ceiling. */
export class PreviewBodyLimitError extends Schema.TaggedError<PreviewBodyLimitError>()(
  "PreviewBodyLimitError",
  {
    actualBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
    maxBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }
) {}

/** The authenticated provider returned a malformed or incoherent state. */
export class PreviewIntegrityError extends Schema.TaggedError<PreviewIntegrityError>()(
  "PreviewIntegrityError",
  {
    check: Schema.Literal(
      "manifest",
      "delivery",
      "domain",
      "renderer",
      "projection",
      "artifact"
    ),
  }
) {}

/** The selected changed document is still compiling and cannot fall back. */
export class PreviewPendingError extends Schema.TaggedError<PreviewPendingError>()(
  "PreviewPendingError",
  { revision: Schema.Number.pipe(Schema.int(), Schema.positive()) }
) {}

/** The selected changed document failed compilation and cannot fall back. */
export class PreviewCompileError extends Schema.TaggedError<PreviewCompileError>()(
  "PreviewCompileError",
  {
    code: Schema.String,
    message: Schema.String,
    revision: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }
) {}

/** No local provider is configured for this development process. */
export class PreviewUnavailableError extends Schema.TaggedError<PreviewUnavailableError>()(
  "PreviewUnavailableError",
  {}
) {}

/** A provider event stream violated the minimal preview protocol. */
export class PreviewEventError extends Schema.TaggedError<PreviewEventError>()(
  "PreviewEventError",
  { stage: Schema.Literal("response", "event") }
) {}

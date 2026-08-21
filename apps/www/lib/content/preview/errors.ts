import { Schema } from "effect";
/** A loopback preview request failed before trusted JSON was available. */
export class PreviewRequestError extends Schema.TaggedError<PreviewRequestError>()(
  "PreviewRequestError",
  {
    stage: Schema.Literals(["connect", "response", "body"]),
    status: Schema.optional(Schema.Finite.pipe(Schema.check(Schema.isInt()))),
  }
) {}
/** A loopback response exceeded its route-specific byte ceiling. */
export class PreviewBodyLimitError extends Schema.TaggedError<PreviewBodyLimitError>()(
  "PreviewBodyLimitError",
  {
    actualBytes: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
    maxBytes: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
  }
) {}
/** The authenticated provider returned a malformed or incoherent state. */
export class PreviewIntegrityError extends Schema.TaggedError<PreviewIntegrityError>()(
  "PreviewIntegrityError",
  {
    check: Schema.Literals([
      "manifest",
      "delivery",
      "domain",
      "renderer",
      "projection",
      "artifact",
    ]),
  }
) {}
/** The selected changed document is still compiling and cannot fall back. */
export class PreviewPendingError extends Schema.TaggedError<PreviewPendingError>()(
  "PreviewPendingError",
  {
    revision: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
  }
) {}
/** The selected changed document failed compilation and cannot fall back. */
export class PreviewCompileError extends Schema.TaggedError<PreviewCompileError>()(
  "PreviewCompileError",
  {
    code: Schema.String,
    message: Schema.String,
    revision: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
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
  { stage: Schema.Literals(["response", "event"]) }
) {}

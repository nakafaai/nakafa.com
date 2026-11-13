import { Schema } from "effect";
/** A loopback preview request failed before trusted JSON was available. */
export class PreviewRequestError extends Schema.TaggedError<
  PreviewRequestError,
  { readonly brand: unique symbol }
>()("PreviewRequestError", {
  stage: Schema.Literals(["connect", "response", "body"]),
  status: Schema.optional(Schema.Finite.pipe(Schema.check(Schema.isInt()))),
}) {}
/** A loopback response exceeded its route-specific byte ceiling. */
export class PreviewBodyLimitError extends Schema.TaggedError<
  PreviewBodyLimitError,
  { readonly brand: unique symbol }
>()("PreviewBodyLimitError", {
  actualBytes: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
  maxBytes: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
}) {}
/** The authenticated provider returned a malformed or incoherent state. */
export class PreviewIntegrityError extends Schema.TaggedError<
  PreviewIntegrityError,
  { readonly brand: unique symbol }
>()("PreviewIntegrityError", {
  check: Schema.Literals([
    "manifest",
    "delivery",
    "domain",
    "renderer",
    "projection",
    "artifact",
  ]),
}) {}
/** No local provider is configured for this development process. */
export class PreviewUnavailableError extends Schema.TaggedError<
  PreviewUnavailableError,
  { readonly brand: unique symbol }
>()("PreviewUnavailableError", {}) {}
/** A provider event stream violated the minimal preview protocol. */
export class PreviewEventError extends Schema.TaggedError<
  PreviewEventError,
  { readonly brand: unique symbol }
>()("PreviewEventError", { stage: Schema.Literals(["response", "event"]) }) {}

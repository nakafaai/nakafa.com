import { Array as Arr, Schema } from "effect";
import type { CliError } from "effect/cli";

export const ProblemDetailsSchema = Schema.Struct({
  code: Schema.String,
  detail: Schema.String,
  instance: Schema.String,
  request_id: Schema.String,
  resolution: Schema.String,
  status: Schema.Finite.pipe(Schema.check(Schema.isInt())),
  title: Schema.String,
  type: Schema.String,
});

export class InvocationError extends Schema.TaggedError<
  InvocationError,
  { readonly brand: unique symbol }
>()("InvocationError", { message: Schema.String }) {}

export class NetworkError extends Schema.TaggedError<
  NetworkError,
  { readonly brand: unique symbol }
>()("NetworkError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}

export class ResponseDecodeError extends Schema.TaggedError<
  ResponseDecodeError,
  { readonly brand: unique symbol }
>()("ResponseDecodeError", {
  cause: Schema.Unknown,
  message: Schema.String,
  status: Schema.Finite.pipe(Schema.check(Schema.isInt())),
}) {}

export class ApiResponseError extends Schema.TaggedError<
  ApiResponseError,
  { readonly brand: unique symbol }
>()("ApiResponseError", {
  problem: ProblemDetailsSchema,
  status: Schema.Finite.pipe(Schema.check(Schema.isInt())),
}) {}

export class HttpResponseError extends Schema.TaggedError<
  HttpResponseError,
  { readonly brand: unique symbol }
>()("HttpResponseError", {
  retryAfter: Schema.optional(Schema.String),
  status: Schema.Finite.pipe(Schema.check(Schema.isInt())),
}) {}

export class CliStartupError extends Schema.TaggedError<
  CliStartupError,
  { readonly brand: unique symbol }
>()("CliStartupError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}

/** Preserves actionable parser details in the stable invocation error shape. */
export function makeInvocationError(error: CliError.CliError) {
  return new InvocationError({
    message:
      error._tag === "ShowHelp"
        ? Arr.join(
            Arr.map(error.errors, ({ message }) => message),
            "\n"
          )
        : error.message,
  });
}

/**
 * A school command the server refused or could not finish: the OAuth error of a sign-in,
 * the API error of a read, or a missing or expired sign-in, with its code and a sentence
 * that says what to do next.
 */
export class SchoolError extends Schema.TaggedError<
  SchoolError,
  { readonly brand: unique symbol }
>()("SchoolError", { code: Schema.String, message: Schema.String }) {}

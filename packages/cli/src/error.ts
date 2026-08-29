import { Schema } from "effect";
import type { CliError } from "effect/unstable/cli";

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

export class InvocationError extends Schema.TaggedError<InvocationError>()(
  "InvocationError",
  { message: Schema.String }
) {}

export class NetworkError extends Schema.TaggedError<NetworkError>()(
  "NetworkError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

export class ResponseDecodeError extends Schema.TaggedError<ResponseDecodeError>()(
  "ResponseDecodeError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    status: Schema.Finite.pipe(Schema.check(Schema.isInt())),
  }
) {}

export class ApiResponseError extends Schema.TaggedError<ApiResponseError>()(
  "ApiResponseError",
  {
    problem: ProblemDetailsSchema,
    status: Schema.Finite.pipe(Schema.check(Schema.isInt())),
  }
) {}

export class HttpResponseError extends Schema.TaggedError<HttpResponseError>()(
  "HttpResponseError",
  {
    retryAfter: Schema.optional(Schema.String),
    status: Schema.Finite.pipe(Schema.check(Schema.isInt())),
  }
) {}

export class CliStartupError extends Schema.TaggedError<CliStartupError>()(
  "CliStartupError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Preserves actionable parser details in the stable invocation error shape. */
export function makeInvocationError(error: CliError.CliError) {
  return new InvocationError({
    message:
      error._tag === "ShowHelp"
        ? error.errors.map(({ message }) => message).join("\n")
        : error.message,
  });
}

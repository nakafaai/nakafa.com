import { casApiKey, casUrl } from "@repo/math/config";
import { MathCasRequestError, MathCasResponseError } from "@repo/math/errors";
import type { MathRequest } from "@repo/math/schema/request";
import { type MathResult, MathResultSchema } from "@repo/math/schema/result";
import { FetchClient } from "@repo/utilities/http/client";
import { Context, Effect, Layer, Result, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";

const CAS_MATH_PATH = "/api/math";
const JSON_CONTENT_TYPE = "application/json";
const CasErrorBodySchema = Schema.Union([
  Schema.Struct({
    detail: Schema.String,
  }),
  Schema.Struct({
    detail: Schema.Array(
      Schema.Struct({
        msg: Schema.String,
      })
    ),
  }),
]);
/**
 * Deterministic math service used by Nina.
 *
 * References:
 * - Effect services: https://effect.website/docs/requirements-management/services/
 * - Effect Schema validation: https://effect.website/docs/schema/introduction/
 * - SymPy capabilities: https://docs.sympy.org/latest/index.html
 */
export class MathService extends Context.Service<
  MathService,
  {
    readonly compute: (
      request: MathRequest
    ) => Effect.Effect<MathResult, MathCasRequestError | MathCasResponseError>;
  }
>()("@repo/math/Math", {
  make: Effect.gen(function* () {
    const baseUrl = yield* casUrl;
    const apiKey = yield* casApiKey;
    const client = yield* HttpClient.HttpClient;
    return {
      compute: Effect.fn("Math.compute")(
        function* (request: MathRequest) {
          const response = yield* HttpClientRequest.post(
            new URL(CAS_MATH_PATH, baseUrl)
          ).pipe(
            HttpClientRequest.bearerToken(apiKey),
            HttpClientRequest.bodyJsonUnsafe(request),
            client.execute,
            Effect.mapError(
              () =>
                new MathCasRequestError({
                  message: "Unable to reach the Nakafa math service.",
                })
            )
          );
          if (response.status < 200 || response.status >= 300) {
            return yield* new MathCasRequestError({
              message: yield* readResponseError(response),
              status: response.status,
            });
          }
          const payload = yield* response.json.pipe(
            Effect.mapError(
              () =>
                new MathCasResponseError({
                  message: "Math service returned an unreadable JSON response.",
                })
            )
          );
          return yield* Schema.decodeUnknownEffect(MathResultSchema)(
            payload
          ).pipe(
            Effect.mapError(
              (error) =>
                new MathCasResponseError({
                  message: error.message,
                })
            )
          );
        },
        // CAS terminates its worker after 20 seconds. This outer budget
        // includes transport and response decoding, and interrupting the
        // request aborts it instead of leaving it alive.
        Effect.timeoutOrElse({
          duration: "25 seconds",
          orElse: () =>
            new MathCasRequestError({
              message: "Math service exceeded its response deadline.",
            }),
        })
      ),
    };
  }).pipe(Effect.provide(FetchClient)),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
/** The shape that MathService provides, derived from its class-style key. */
export type MathRuntime = Context.Service.Shape<typeof MathService>;
/** Reads math service JSON errors without leaking framework HTML pages into chat. */
const readResponseError = Effect.fn("Math.readResponseError")(function* (
  response: HttpClientResponse.HttpClientResponse
) {
  const body = yield* Effect.result(response.text);
  if (Result.isFailure(body) || body.success.length === 0) {
    return `Math request failed with status ${response.status}.`;
  }
  if (!response.headers["content-type"]?.includes(JSON_CONTENT_TYPE)) {
    return `Math request failed with status ${response.status}.`;
  }
  const decoded = yield* Effect.result(
    Schema.decodeEffect(Schema.fromJsonString(CasErrorBodySchema))(body.success)
  );
  if (Result.isFailure(decoded)) {
    return `Math request failed with status ${response.status}.`;
  }
  if (typeof decoded.success.detail === "string") {
    return decoded.success.detail;
  }
  return decoded.success.detail.map((issue) => issue.msg).join(" ");
});

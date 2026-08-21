import { casApiKey, casUrl } from "@repo/math/config";
import { MathCasRequestError, MathCasResponseError } from "@repo/math/errors";
import type { MathRequest } from "@repo/math/schema/request";
import { type MathResult, MathResultSchema } from "@repo/math/schema/result";
import { Context, Effect, Layer, Redacted, Result, Schema } from "effect";

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
export interface MathRuntime {
  readonly compute: (
    request: MathRequest
  ) => Effect.Effect<MathResult, MathCasRequestError | MathCasResponseError>;
}

export class MathService extends Context.Service<MathService, MathRuntime>()(
  "@repo/math/Math",
  {
    make: Effect.gen(function* () {
      const baseUrl = yield* casUrl;
      const apiKey = yield* casApiKey;
      return {
        compute: (request: MathRequest) =>
          Effect.gen(function* () {
            const response = yield* Effect.tryPromise({
              try: () =>
                fetch(new URL(CAS_MATH_PATH, baseUrl), {
                  body: JSON.stringify(request),
                  headers: {
                    Authorization: `Bearer ${Redacted.value(apiKey)}`,
                    "Content-Type": "application/json",
                  },
                  method: "POST",
                }),
              catch: () =>
                new MathCasRequestError({
                  message: "Unable to reach the Nakafa math service.",
                }),
            });
            if (!response.ok) {
              return yield* new MathCasRequestError({
                message: yield* readResponseError(response),
                status: response.status,
              });
            }
            const payload = yield* Effect.tryPromise({
              try: () => response.json(),
              catch: () =>
                new MathCasResponseError({
                  message: "Math service returned an unreadable JSON response.",
                }),
            });
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
          }),
      };
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make);
}
/** Reads math service JSON errors without leaking framework HTML pages into chat. */
const readResponseError = Effect.fn("Math.readResponseError")(function* (
  response: Response
) {
  const body = yield* Effect.result(
    Effect.tryPromise({
      try: () => response.text(),
      catch: () =>
        new MathCasRequestError({
          message: "Math service returned an unreadable error response.",
          status: response.status,
        }),
    })
  );
  if (Result.isFailure(body) || body.success.length === 0) {
    return `Math request failed with status ${response.status}.`;
  }
  if (!response.headers.get("content-type")?.includes(JSON_CONTENT_TYPE)) {
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

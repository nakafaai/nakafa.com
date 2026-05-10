import { MathCasRequestError, MathCasResponseError } from "@repo/math/errors";
import { casApiKey, casUrl } from "@repo/math/keys";
import type { MathRequest } from "@repo/math/schema";
import { MathResultSchema } from "@repo/math/schema";
import { Effect, Redacted, Schema } from "effect";

const CAS_MATH_PATH = "/api/math";

/**
 * Deterministic CAS-backed math service used by Nina.
 *
 * References:
 * - Effect services: https://effect.website/docs/requirements-management/services/
 * - Effect Schema validation: https://effect.website/docs/schema/introduction/
 * - SymPy capabilities: https://docs.sympy.org/latest/index.html
 */
export class MathService extends Effect.Service<MathService>()(
  "@repo/math/Math",
  {
    accessors: true,
    effect: Effect.gen(function* () {
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
                  message: "Unable to reach the Nakafa CAS service.",
                }),
            });

            if (!response.ok) {
              return yield* Effect.fail(
                new MathCasRequestError({
                  message: yield* readResponseError(response),
                  status: response.status,
                })
              );
            }

            const payload = yield* Effect.tryPromise({
              try: () => response.json(),
              catch: () =>
                new MathCasResponseError({
                  message: "CAS returned an unreadable JSON response.",
                }),
            });

            return yield* Schema.decodeUnknown(MathResultSchema)(payload).pipe(
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
) {}

/** Reads CAS error text while preserving the original HTTP status. */
const readResponseError = Effect.fn("Math.readResponseError")(function* (
  response: Response
) {
  const body = yield* Effect.either(
    Effect.tryPromise({
      try: () => response.text(),
      catch: () =>
        new MathCasRequestError({
          message: "CAS returned an unreadable error response.",
          status: response.status,
        }),
    })
  );

  if (body._tag === "Left" || body.right.length === 0) {
    return `CAS request failed with status ${response.status}.`;
  }

  return body.right;
});

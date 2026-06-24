import { casApiKey, casUrl } from "@repo/math/config";
import { MathCasRequestError, MathCasResponseError } from "@repo/math/errors";
import type { MathRequest } from "@repo/math/schema/request";
import { MathResultSchema } from "@repo/math/schema/result";
import { Effect, Redacted, Schema } from "effect";

const CAS_MATH_PATH = "/api/math";
const JSON_CONTENT_TYPE = "application/json";

const CasErrorBodySchema = Schema.Union(
  Schema.Struct({
    detail: Schema.String,
  }),
  Schema.Struct({
    detail: Schema.Array(
      Schema.Struct({
        msg: Schema.String,
      })
    ),
  })
);

/** Capability-based CAS Adapter seam backed by the private SymPy HTTP service. */
export class CasEngine extends Effect.Service<CasEngine>()(
  "@repo/math/CasEngine",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const baseUrl = yield* casUrl;
      const apiKey = yield* casApiKey;

      return {
        capabilities: Effect.succeed([
          "algebra",
          "equation",
          "calculus",
          "coordinate-geometry",
        ]),
        compute: computeViaHttp({ apiKey, baseUrl }),
      };
    }),
  }
) {}

/** Builds the live CAS compute method from validated runtime configuration. */
function computeViaHttp({
  apiKey,
  baseUrl,
}: {
  readonly apiKey: Redacted.Redacted<string>;
  readonly baseUrl: string;
}) {
  return Effect.fn("CasEngine.compute")(function* (request: MathRequest) {
    const transportPayload = casTransportRequest(request);
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(new URL(CAS_MATH_PATH, baseUrl), {
          body: JSON.stringify(transportPayload),
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
          message: "Math service returned an unreadable JSON response.",
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
  });
}

/** Removes domain-only planning metadata before crossing the CAS Adapter seam. */
function casTransportRequest(request: MathRequest) {
  return { ...request, pointSemantics: undefined };
}

/** Reads CAS JSON errors without leaking framework HTML pages into evidence. */
const readResponseError = Effect.fn("CasEngine.readResponseError")(function* (
  response: Response
) {
  const body = yield* Effect.either(
    Effect.tryPromise({
      try: () => response.text(),
      catch: () =>
        new MathCasRequestError({
          message: "Math service returned an unreadable error response.",
          status: response.status,
        }),
    })
  );

  if (body._tag === "Left" || body.right.length === 0) {
    return `Math request failed with status ${response.status}.`;
  }

  if (!response.headers.get("content-type")?.includes(JSON_CONTENT_TYPE)) {
    return `Math request failed with status ${response.status}.`;
  }

  const decoded = yield* Effect.either(
    Schema.decodeUnknown(Schema.parseJson(CasErrorBodySchema))(body.right)
  );

  if (decoded._tag === "Left") {
    return `Math request failed with status ${response.status}.`;
  }

  if (typeof decoded.right.detail === "string") {
    return decoded.right.detail;
  }

  return decoded.right.detail.map((issue) => issue.msg).join(" ");
});

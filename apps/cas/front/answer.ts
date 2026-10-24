import { Effect, Schema } from "effect";
import { isAuthorized } from "@/front/auth";
import { type CasSolverNamespace, forwardMath } from "@/front/forward";
import { CAS_HEALTH_PATH, routeOf } from "@/front/route";
import { readBoundedBody } from "@/front/size";

/** The largest request body that the engine accepts: 64 KiB. */
export const MAX_REQUEST_BYTES = 64 * 1024;

/** The bindings of the front Worker: the engine namespace and the bearer key. */
export interface CasFrontEnv {
  readonly CAS_SOLVER: CasSolverNamespace;
  readonly MATH_CAS_API_KEY?: string | undefined;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const DetailJson = Schema.fromJsonString(
  Schema.Struct({ detail: Schema.String })
);
const HealthJson = Schema.fromJsonString(
  Schema.Struct({ status: Schema.Literal("ok") })
);

/** An error response with the `detail` shape that the TypeScript math client reads. */
function detail(
  status: number,
  message: string,
  allow?: string
): Effect.Effect<Response> {
  return Schema.encodeEffect(DetailJson)({ detail: message }).pipe(
    // The schema describes a constant shape, so encoding it cannot fail.
    Effect.orDie,
    Effect.map(
      (body) =>
        new Response(body, {
          status,
          headers:
            allow === undefined ? JSON_HEADERS : { ...JSON_HEADERS, allow },
        })
    )
  );
}

const answerRequest = Effect.fn("cas.answer.request")(function* (
  request: Request,
  env: CasFrontEnv
) {
  const { pathname } = new URL(request.url);
  const route = routeOf(request.method, pathname);
  if (route === "health") {
    const body = yield* Schema.encodeEffect(HealthJson)({ status: "ok" }).pipe(
      Effect.orDie
    );
    return new Response(body, { headers: JSON_HEADERS });
  }
  if (route === "notFound") {
    return yield* detail(404, "Not found.");
  }
  if (route === "methodNotAllowed") {
    return yield* detail(
      405,
      "Method not allowed.",
      pathname === CAS_HEALTH_PATH ? "GET" : "POST"
    );
  }

  const apiKey = env.MATH_CAS_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    return yield* detail(500, "The math service is not configured.");
  }
  if (!isAuthorized(request.headers.get("authorization"), apiKey)) {
    return yield* detail(401, "Invalid CAS API key.");
  }
  const body = yield* readBoundedBody(request.body, MAX_REQUEST_BYTES);
  return yield* forwardMath(env.CAS_SOLVER, body);
});

/**
 * Answers one request of the public CAS host. Every failure becomes a response
 * with a status, so the caller never sees a stack trace or a binding name.
 */
export const answer = (
  request: Request,
  env: CasFrontEnv
): Effect.Effect<Response> =>
  answerRequest(request, env).pipe(
    Effect.catchTags({
      CasRequestTooLarge: () =>
        detail(422, "Math request exceeds the supported size."),
      CasRequestUnreadable: () =>
        detail(400, "Math request could not be read."),
      CasEngineFailed: (failure) =>
        detail(
          503,
          failure.overloaded
            ? "Math service is busy. Please retry shortly."
            : "Math calculation could not complete."
        ),
    })
  );

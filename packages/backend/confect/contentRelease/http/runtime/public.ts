import { MAX_PUBLIC_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { readRuntimeRequest } from "@repo/backend/confect/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/confect/contentRelease/http/runtime/response";
import { dispatchProgram } from "@repo/backend/confect/contentRelease/runtime/publication/dispatch";
import { PUBLIC_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { Config, Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/** Authenticates and forwards one bounded public runtime request. */
const publicRuntimeRoute = Effect.fn("contentRelease.publicRuntimeRoute")(
  function* (request: Request) {
    const input = yield* readRuntimeRequest(
      request,
      yield* Config.String("CONTENT_RUNTIME_TOKEN").pipe(Effect.orDie),
      MAX_PUBLIC_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    return yield* dispatchProgram(input.body.source, input.body.byteLength);
  }
);
export const publicRuntimeRoutes = HttpRouter.add(
  "POST",
  PUBLIC_CONTENT_RUNTIME_PATH,
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const result = yield* publicRuntimeRoute(request);
    return HttpServerResponse.fromWeb(privateRuntimeResponse(result));
  })
);

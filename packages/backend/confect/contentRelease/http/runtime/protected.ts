import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import refs from "@repo/backend/confect/_generated/refs";
import { ActionRunner } from "@repo/backend/confect/_generated/services";
import { readRuntimeRequest } from "@repo/backend/confect/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/confect/contentRelease/http/runtime/response";
import { failureResult } from "@repo/backend/confect/contentRelease/runtime/result";
import { PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { Config, Effect, flow, Result, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/** The isolated Node verifier could not return one sanitized response. */
class ProtectedRuntimeActionError extends Schema.TaggedError<ProtectedRuntimeActionError>()(
  "ProtectedRuntimeActionError",
  {}
) {}

/** Calls the Node-only verifier without exposing an action failure. */
const dispatchProtectedRuntime = Effect.fn(
  "contentRelease.dispatchProtectedRuntime"
)(function* (input: { readonly byteLength: number; readonly source: string }) {
  const { runAction } = yield* ActionRunner;
  const result = yield* runAction(
    refs.internal.contentRelease.runtime.tryout.dispatch.dispatch,
    input
  ).pipe(
    Effect.mapError(() => ProtectedRuntimeActionError.make()),
    Effect.catchDefect(
      flow(() => ProtectedRuntimeActionError.make(), Effect.fail)
    ),
    Effect.result
  );
  return Result.isFailure(result)
    ? failureResult("CONTENT_RUNTIME_INTERNAL", 500)
    : result.success;
});

/** Authenticates and forwards one bounded protected runtime request. */
const protectedRuntimeRoute = Effect.fn("contentRelease.protectedRuntimeRoute")(
  function* (request: Request) {
    const input = yield* readRuntimeRequest(
      request,
      yield* Config.String("CONTENT_RUNTIME_TOKEN").pipe(Effect.orDie),
      MAX_PROTECTED_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    return yield* dispatchProtectedRuntime(input.body);
  }
);
export const protectedRuntimeRoutes = HttpRouter.add(
  "POST",
  PROTECTED_CONTENT_RUNTIME_PATH,
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const result = yield* protectedRuntimeRoute(request);
    return HttpServerResponse.fromWeb(privateRuntimeResponse(result));
  })
);

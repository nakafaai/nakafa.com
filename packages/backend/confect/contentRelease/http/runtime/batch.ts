import { readRuntimeRequest } from "@repo/backend/confect/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/confect/contentRelease/http/runtime/response";
import { dispatchBatchProgram } from "@repo/backend/confect/contentRelease/runtime/publication/batch";
import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import { PUBLIC_CONTENT_RUNTIME_BATCH_PATH } from "@repo/backend/content/endpoint";
import { Config, Effect } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

/** Authenticates and forwards one bounded public batch contract. */
const readPublicRuntimeBatch = Effect.fn(
  "contentRelease.readPublicRuntimeBatch"
)(function* (request: Request) {
  const input = yield* readRuntimeRequest(
    request,
    yield* Config.String("CONTENT_RUNTIME_TOKEN").pipe(Effect.orDie),
    MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES
  );
  if (input.kind === "rejected") {
    return input.result;
  }
  return yield* dispatchBatchProgram(input.body.source, input.body.byteLength);
});
export const batchRuntimeRoutes = HttpRouter.add(
  "POST",
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const result = yield* readPublicRuntimeBatch(request);
    return HttpServerResponse.fromWeb(privateRuntimeResponse(result));
  })
);

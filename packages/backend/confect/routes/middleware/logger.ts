import { isForumAttachmentUploadPath } from "@repo/backend/confect/classes/forums/attachments/route";
import { Clock, Effect } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/unstable/http";
/** Logs HTTP outcomes without query strings or upload capabilities. */
export const requestLogger = HttpRouter.middleware((handler) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const path = new URL(request.originalUrl, "https://origin.nakafa.com")
      .pathname;
    if (isForumAttachmentUploadPath(path)) {
      return yield* handler;
    }
    const startedAt = yield* Clock.currentTimeMillis;
    const response = yield* handler;
    const finishedAt = yield* Clock.currentTimeMillis;
    yield* Effect.logInfo("HTTP request completed").pipe(
      Effect.annotateLogs({
        method: request.method,
        path,
        status: response.status,
        durationMs: finishedAt - startedAt,
      })
    );
    return response;
  })
);

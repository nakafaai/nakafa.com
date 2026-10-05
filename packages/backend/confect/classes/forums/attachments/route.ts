import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  Scheduler,
  StorageActionWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX } from "@repo/backend/confect/classes/forums/attachments/constants";
import { MAX_FORUM_ATTACHMENT_BYTES } from "@repo/backend/confect/classes/forums/constants";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { generateId } from "@repo/backend/confect/utils/id";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { Duration, Effect, flow, Layer, Result, Schema } from "effect";
import {
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

const uploadPath = `${FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX}/:uploadId/:uploadToken`;
class ForumAttachmentHttpError extends Schema.TaggedError<ForumAttachmentHttpError>()(
  "ForumAttachmentHttpError",
  {
    code: Schema.Literals([
      "FORUM_ATTACHMENT_UPLOAD_INVALID",
      "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
      "FORUM_ATTACHMENT_UPLOAD_FAILED",
    ]),
    operation: Schema.Literals([
      "body",
      "claim",
      "cleanup",
      "release",
      "settle",
      "store",
    ]),
    status: Schema.Literals([404, 413, 415, 500]),
  }
) {}
function uploadError(
  code: ForumAttachmentHttpError["code"],
  operation: ForumAttachmentHttpError["operation"],
  status: ForumAttachmentHttpError["status"]
) {
  return new ForumAttachmentHttpError({
    code,
    operation,
    status,
  });
}
/** Releases one failed request's lease without replacing its original error. */
const releaseUploadLease = Effect.fn(
  "classes.forums.attachments.releaseUploadLease"
)(function* (uploadId: string, leaseId: string) {
  const { runMutation } = yield* MutationRunner;
  const release = yield* Effect.result(
    runMutation(refs.internal.classes.forums.attachments.upload.release, {
      leaseId,
      uploadId,
    }).pipe(
      Effect.mapError(() =>
        uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "release", 500)
      ),
      Effect.catchDefect(
        flow(
          () => uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "release", 500),
          Effect.fail
        )
      )
    )
  );
  if (Result.isFailure(release)) {
    yield* Effect.logError("Forum attachment upload lease release failed").pipe(
      Effect.annotateLogs({
        code: release.failure.code,
        operation: release.failure.operation,
      })
    );
  }
});
/** Identifies the capability-bearing route so access logs never record it. */
export function isForumAttachmentUploadPath(path: string) {
  return path.startsWith(`${FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX}/`);
}
/** Reads one bounded binary body without trusting its Content-Length header. */
const readUploadBody = Effect.fn("classes.forums.attachments.readUploadBody")(
  function* (request: Request) {
    const contentType = request.headers.get("content-type")?.trim();
    if (!contentType) {
      return yield* uploadError("FORUM_ATTACHMENT_UPLOAD_INVALID", "body", 415);
    }
    yield* parseContentLength(
      request.headers.get("content-length"),
      MAX_FORUM_ATTACHMENT_BYTES
    ).pipe(
      Effect.mapError(() =>
        uploadError("FORUM_ATTACHMENT_UPLOAD_INVALID", "body", 413)
      )
    );
    if (!request.body) {
      return {
        bytes: new Uint8Array(),
        contentType,
      };
    }
    const bytes = yield* readBoundedBody(
      request.body,
      MAX_FORUM_ATTACHMENT_BYTES
    ).pipe(
      Effect.mapError(() =>
        uploadError("FORUM_ATTACHMENT_UPLOAD_INVALID", "body", 413)
      )
    );
    return {
      bytes,
      contentType,
    };
  }
);
/** Stores and binds one upload while cleaning every failed storage write. */
const uploadForumAttachment = Effect.fn("classes.forums.attachments.upload")(
  function* (request: Request, uploadId: string, uploadToken: string) {
    const { runMutation } = yield* MutationRunner;
    const leaseId = yield* Effect.try({
      try: generateId,
      catch: () => uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "claim", 500),
    });
    const claimed = yield* runMutation(
      refs.internal.classes.forums.attachments.upload.claim,
      {
        leaseId,
        uploadId,
        uploadToken,
      }
    ).pipe(
      Effect.mapError(() =>
        uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "claim", 500)
      ),
      Effect.catchDefect(
        flow(
          () => uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "claim", 500),
          Effect.fail
        )
      )
    );
    if (!claimed) {
      return yield* uploadError(
        "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        "claim",
        404
      );
    }
    const upload = yield* Effect.result(
      Effect.gen(function* () {
        const storageActionWriter = yield* StorageActionWriter;
        const storageWriter = yield* StorageWriter;
        const { runMutation } = yield* MutationRunner;
        const { bytes, contentType } = yield* readUploadBody(request);
        const storageId = yield* storageActionWriter
          .store(
            new Blob([new Uint8Array(bytes)], {
              type: contentType,
            })
          )
          .pipe(
            Effect.catchDefect(
              flow(
                () =>
                  uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "store", 500),
                Effect.fail
              )
            )
          );
        const settlement = yield* Effect.result(
          (yield* Scheduler)
            .runAfter(
              Duration.hours(24),
              refs.internal.classes.forums.attachments.upload.cleanup,
              { storageId }
            )
            .pipe(
              Effect.andThen(() =>
                runMutation(
                  refs.internal.classes.forums.attachments.upload.settle,
                  {
                    contentType,
                    leaseId,
                    size: bytes.byteLength,
                    storageId,
                    uploadId,
                    uploadToken,
                  }
                )
              ),
              Effect.mapError(() =>
                uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "settle", 500)
              ),
              Effect.catchDefect(
                flow(
                  () =>
                    uploadError(
                      "FORUM_ATTACHMENT_UPLOAD_FAILED",
                      "settle",
                      500
                    ),
                  Effect.fail
                )
              )
            )
        );
        if (Result.isFailure(settlement)) {
          yield* storageWriter
            .delete(storageId)
            .pipe(
              Effect.mapError(() =>
                uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "cleanup", 500)
              )
            );
          return yield* settlement.failure;
        }
        if (settlement.success !== "accepted") {
          return yield* uploadError(
            "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
            "settle",
            404
          );
        }
        return storageId;
      })
    );
    if (Result.isFailure(upload)) {
      yield* releaseUploadLease(uploadId, leaseId);
      return yield* upload.failure;
    }
    return upload.success;
  }
);
const uploadCors = HttpRouter.middleware((handler) =>
  Effect.gen(function* () {
    const site = yield* readSiteUrl().pipe(Effect.orDie);
    return yield* HttpMiddleware.cors({
      allowedHeaders: ["Content-Type"],
      allowedMethods: ["POST", "OPTIONS"],
      maxAge: 3600,
      allowedOrigins: [site.origin],
    })(handler);
  })
);
const uploadPreflight = HttpRouter.route(
  "OPTIONS",
  uploadPath,
  HttpServerResponse.empty({
    status: 204,
  })
);

/** Serves the capability-authenticated upload protocol. */
export const attachmentRoutes = HttpRouter.addAll([
  HttpRouter.route(
    "POST",
    uploadPath,
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.toWeb(
        yield* HttpServerRequest.HttpServerRequest
      );
      const { uploadId, uploadToken } = yield* HttpRouter.schemaPathParams(
        Schema.Struct({
          uploadId: Schema.String,
          uploadToken: Schema.String,
        })
      );
      const result = yield* uploadForumAttachment(
        request,
        uploadId,
        uploadToken
      ).pipe(Effect.result);
      const headers = {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      };
      if (Result.isFailure(result)) {
        if (result.failure.status === 500) {
          yield* Effect.logError("Forum attachment upload failed").pipe(
            Effect.annotateLogs({
              code: result.failure.code,
              operation: result.failure.operation,
            })
          );
        }
        return HttpServerResponse.jsonUnsafe(
          {
            code: result.failure.code,
          },
          {
            status: result.failure.status,
            headers,
          }
        );
      }
      return HttpServerResponse.jsonUnsafe(
        {
          storageId: result.success,
        },
        {
          headers,
        }
      );
    })
  ),
  uploadPreflight,
]).pipe(Layer.provide(uploadCors.layer));

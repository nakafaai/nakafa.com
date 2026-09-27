import {
  MutationRunner,
  StorageActionWriter,
  StorageWriter,
} from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import { FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX } from "@repo/backend/confect/classes/forums/attachments/constants";
import { MAX_FORUM_ATTACHMENT_BYTES } from "@repo/backend/confect/classes/forums/constants";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { generateId } from "@repo/backend/confect/utils/id";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, flow, Result, Schema } from "effect";
import { cors } from "hono/cors";

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
)(function* (ctx: ActionCtx, uploadId: string, leaseId: string) {
  const runMutation = yield* MutationRunner.MutationRunner.pipe(
    Effect.provide(MutationRunner.layer(ctx.runMutation))
  );
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
  function* (
    ctx: ActionCtx,
    request: Request,
    uploadId: string,
    uploadToken: string
  ) {
    const runMutation = yield* MutationRunner.MutationRunner.pipe(
      Effect.provide(MutationRunner.layer(ctx.runMutation))
    );
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
        const storageActionWriter =
          yield* StorageActionWriter.StorageActionWriter.pipe(
            Effect.provide(
              StorageActionWriter.StorageActionWriter.layer(ctx.storage)
            )
          );
        const storageWriter = yield* StorageWriter.StorageWriter.pipe(
          Effect.provide(StorageWriter.StorageWriter.layer(ctx.storage))
        );
        const runMutation = yield* MutationRunner.MutationRunner.pipe(
          Effect.provide(MutationRunner.layer(ctx.runMutation))
        );
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
          runMutation(refs.internal.classes.forums.attachments.upload.settle, {
            contentType,
            leaseId,
            size: bytes.byteLength,
            storageId,
            uploadId,
            uploadToken,
          }).pipe(
            Effect.mapError(() =>
              uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "settle", 500)
            ),
            Effect.catchDefect(
              flow(
                () =>
                  uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "settle", 500),
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
      yield* releaseUploadLease(ctx, uploadId, leaseId);
      return yield* upload.failure;
    }
    return upload.success;
  }
);
/** Registers the browser-facing, capability-authenticated upload adapter. */
export function registerForumAttachmentUploadRoute<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.use(
    `${FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX}/*`,
    cors({
      allowHeaders: ["Content-Type"],
      allowMethods: ["POST", "OPTIONS"],
      maxAge: 3600,
      origin: () =>
        runConvexProgram(readSiteUrl().pipe(Effect.map((url) => url.origin))),
    })
  );
  app.post(uploadPath, async (c) => {
    const result = await Effect.runPromise(
      Effect.result(
        uploadForumAttachment(
          c.env,
          c.req.raw,
          c.req.param("uploadId"),
          c.req.param("uploadToken")
        )
      )
    );
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (Result.isFailure(result)) {
      if (result.failure.status === 500) {
        await Effect.runPromise(
          Effect.logError("Forum attachment upload failed").pipe(
            Effect.annotateLogs({
              code: result.failure.code,
              operation: result.failure.operation,
            })
          )
        );
      }
      return c.json(
        {
          code: result.failure.code,
        },
        result.failure.status,
        headers
      );
    }
    return c.json(
      {
        storageId: result.success,
      },
      200,
      headers
    );
  });
}

import { internal } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX } from "@repo/backend/convex/classes/forums/attachments/constants";
import { MAX_FORUM_ATTACHMENT_BYTES } from "@repo/backend/convex/classes/forums/utils/constants";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Either, Schema } from "effect";
import { cors } from "hono/cors";

const uploadPath = `${FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX}/:uploadId/:uploadToken`;

class ForumAttachmentHttpError extends Schema.TaggedError<ForumAttachmentHttpError>()(
  "ForumAttachmentHttpError",
  {
    code: Schema.Literal(
      "FORUM_ATTACHMENT_UPLOAD_INVALID",
      "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
      "FORUM_ATTACHMENT_UPLOAD_FAILED"
    ),
    operation: Schema.Literal(
      "authorize",
      "body",
      "cleanup",
      "settle",
      "store"
    ),
    status: Schema.Literal(404, 413, 415, 500),
  }
) {}

function uploadError(
  code: ForumAttachmentHttpError["code"],
  operation: ForumAttachmentHttpError["operation"],
  status: ForumAttachmentHttpError["status"]
) {
  return new ForumAttachmentHttpError({ code, operation, status });
}

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
      return { bytes: new Uint8Array(), contentType };
    }

    const bytes = yield* readBoundedBody(
      request.body,
      MAX_FORUM_ATTACHMENT_BYTES
    ).pipe(
      Effect.mapError(() =>
        uploadError("FORUM_ATTACHMENT_UPLOAD_INVALID", "body", 413)
      )
    );

    return { bytes, contentType };
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
    const authorized = yield* Effect.tryPromise({
      try: () =>
        ctx.runQuery(internal.classes.forums.attachments.upload.authorize, {
          uploadId,
          uploadToken,
        }),
      catch: () =>
        uploadError("FORUM_ATTACHMENT_UPLOAD_NOT_FOUND", "authorize", 404),
    });

    if (!authorized) {
      return yield* uploadError(
        "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        "authorize",
        404
      );
    }

    const { bytes, contentType } = yield* readUploadBody(request);
    const storageId = yield* Effect.tryPromise({
      try: () =>
        ctx.storage.store(
          new Blob([new Uint8Array(bytes)], { type: contentType })
        ),
      catch: () => uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "store", 500),
    });
    const settlement = yield* Effect.either(
      Effect.tryPromise({
        try: () =>
          ctx.runMutation(internal.classes.forums.attachments.upload.settle, {
            contentType,
            size: bytes.byteLength,
            storageId,
            uploadId,
            uploadToken,
          }),
        catch: () =>
          uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "settle", 500),
      })
    );

    if (Either.isLeft(settlement)) {
      yield* Effect.tryPromise({
        try: () => ctx.storage.delete(storageId),
        catch: () =>
          uploadError("FORUM_ATTACHMENT_UPLOAD_FAILED", "cleanup", 500),
      });
      return yield* settlement.left;
    }

    if (settlement.right !== "accepted") {
      return yield* uploadError(
        "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
        "settle",
        404
      );
    }

    return storageId;
  }
);

/** Registers the browser-facing, capability-authenticated upload adapter. */
export function registerForumAttachmentUploadRoute(
  app: HonoWithConvex<ActionCtx>
) {
  app.use(
    `${FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX}/*`,
    cors({
      allowHeaders: ["Content-Type"],
      allowMethods: ["POST", "OPTIONS"],
      maxAge: 3600,
      origin: siteOrigin,
    })
  );

  app.post(uploadPath, async (c) => {
    const result = await Effect.runPromise(
      Effect.either(
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

    if (Either.isLeft(result)) {
      if (result.left.status === 500) {
        await Effect.runPromise(
          Effect.logError("Forum attachment upload failed").pipe(
            Effect.annotateLogs({
              code: result.left.code,
              operation: result.left.operation,
            })
          )
        );
      }
      return c.json({ code: result.left.code }, result.left.status, headers);
    }

    return c.json({ storageId: result.right }, 200, headers);
  });
}

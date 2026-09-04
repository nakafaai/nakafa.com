import {
  type ContentRuntimeArchiveAbort,
  ContentRuntimeArchiveAbortSchema,
  type ContentRuntimeArchiveClaim,
  ContentRuntimeArchiveClaimSchema,
  type ContentRuntimeArchiveFinalize,
  ContentRuntimeArchiveFinalizeSchema,
  type ContentRuntimeArchiveIdentity,
  ContentRuntimeArchiveIdentitySchema,
} from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_ABORT_PATH,
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
  CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
  CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH,
  CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH,
} from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import {
  archiveError,
  archiveResponse,
  callArchive,
  readArchiveRequest,
  runArchiveRoute,
} from "@repo/backend/convex/contentRelease/archive/request";
import type {
  runtimeArchiveAbortResultValidator,
  runtimeArchiveClaimResultValidator,
  runtimeArchiveDownloadValidator,
  runtimeArchiveFinalizeResultValidator,
  runtimeArchiveReleaseResultValidator,
} from "@repo/backend/convex/contentRelease/archive/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, type Schema } from "effect";

type ArchiveDownload = Infer<typeof runtimeArchiveDownloadValidator>;
type ClaimResult = Infer<typeof runtimeArchiveClaimResultValidator>;
type FinalizeResult = Infer<typeof runtimeArchiveFinalizeResultValidator>;
type AbortResult = Infer<typeof runtimeArchiveAbortResultValidator>;
type ReleaseResult = Infer<typeof runtimeArchiveReleaseResultValidator>;

const downloadReference = makeFunctionReference<
  "query",
  ContentRuntimeArchiveIdentity,
  ArchiveDownload | null
>("contentRelease/archive/internal:download");

const claimReference = makeFunctionReference<
  "mutation",
  ContentRuntimeArchiveClaim,
  ClaimResult
>("contentRelease/archive/internal:claim");

const finalizeReference = makeFunctionReference<
  "mutation",
  ContentRuntimeArchiveFinalize,
  FinalizeResult
>("contentRelease/archive/internal:finalize");

const abortReference = makeFunctionReference<
  "mutation",
  ContentRuntimeArchiveAbort,
  AbortResult
>("contentRelease/archive/internal:abort");

const releaseReference = makeFunctionReference<
  "mutation",
  ContentRuntimeArchiveClaim,
  ReleaseResult
>("contentRelease/archive/internal:release");

const ownsReference = makeFunctionReference<
  "mutation",
  ContentRuntimeArchiveClaim,
  boolean
>("contentRelease/archive/internal:owns");

function readRequest<A, I>(
  request: Request,
  schema: Schema.Codec<A, I, never, never>,
  access: "read" | "write"
) {
  return access === "read"
    ? readArchiveRequest(
        request,
        schema,
        "x-nakafa-content-token",
        env.CONTENT_RUNTIME_TOKEN
      )
    : readArchiveRequest(
        request,
        schema,
        "x-nakafa-archive-token",
        env.CONTENT_ARCHIVE_TOKEN
      );
}

const loadArchive = Effect.fn("contentRuntimeArchive.load")(function* (
  ctx: ActionCtx,
  request: Request
) {
  const identity = yield* readRequest(
    request,
    ContentRuntimeArchiveIdentitySchema,
    "read"
  );
  const archive = yield* callArchive(() =>
    ctx.runQuery(downloadReference, identity)
  );
  if (!archive) {
    return yield* archiveError("CONTENT_RUNTIME_ARCHIVE_NOT_FOUND", 404);
  }
  return archive;
});

function claimArchive(ctx: ActionCtx, claim: ContentRuntimeArchiveClaim) {
  return callArchive(() => ctx.runMutation(claimReference, claim));
}

/** Registers the authenticated immutable runtime archive protocol. */
export function registerContentRuntimeArchiveRoutes<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.post(CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH, (context) =>
    runArchiveRoute(
      Effect.gen(function* () {
        const input = yield* readRequest(
          context.req.raw,
          ContentRuntimeArchiveClaimSchema,
          "write"
        );
        const result = yield* claimArchive(context.env, input);
        return archiveResponse(result, 200);
      })
    )
  );

  app.post(CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH, (context) =>
    runArchiveRoute(
      Effect.gen(function* () {
        const input = yield* readRequest(
          context.req.raw,
          ContentRuntimeArchiveClaimSchema,
          "write"
        );
        return archiveResponse(
          yield* callArchive(() =>
            context.env.runMutation(releaseReference, input)
          ),
          200
        );
      })
    )
  );

  app.post(CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH, (context) =>
    runArchiveRoute(
      Effect.gen(function* () {
        const input = yield* readRequest(
          context.req.raw,
          ContentRuntimeArchiveClaimSchema,
          "write"
        );
        const ownsClaim = yield* callArchive(() =>
          context.env.runMutation(ownsReference, input)
        );
        if (!ownsClaim) {
          return yield* archiveError("CONTENT_RUNTIME_ARCHIVE_BUSY", 409);
        }
        return archiveResponse(
          {
            uploadUrl: yield* callArchive(() =>
              context.env.storage.generateUploadUrl()
            ),
          },
          200
        );
      })
    )
  );

  app.post(CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH, (context) =>
    runArchiveRoute(
      Effect.gen(function* () {
        const input = yield* readRequest(
          context.req.raw,
          ContentRuntimeArchiveFinalizeSchema,
          "write"
        );
        const result = yield* callArchive(() =>
          context.env.runMutation(finalizeReference, input)
        );
        if (result.kind === "conflict") {
          return yield* archiveError("CONTENT_RUNTIME_ARCHIVE_CONFLICT", 409);
        }
        if (result.kind === "invalid") {
          return yield* archiveError("CONTENT_RUNTIME_ARCHIVE_INVALID", 400);
        }
        return archiveResponse(result, 200);
      })
    )
  );

  app.post(CONTENT_RUNTIME_ARCHIVE_ABORT_PATH, (context) =>
    runArchiveRoute(
      Effect.gen(function* () {
        const input = yield* readRequest(
          context.req.raw,
          ContentRuntimeArchiveAbortSchema,
          "write"
        );
        const result = yield* callArchive(() =>
          context.env.runMutation(abortReference, input)
        );
        if (result.kind === "invalid") {
          return yield* archiveError("CONTENT_RUNTIME_ARCHIVE_INVALID", 400);
        }
        return archiveResponse(result, 200);
      })
    )
  );

  app.post(CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH, (context) =>
    runArchiveRoute(
      Effect.gen(function* () {
        const archive = yield* loadArchive(context.env, context.req.raw);
        return archiveResponse(
          {
            archiveSha256: archive.archiveSha256,
            byteLength: archive.byteLength,
            contentStateHash: archive.contentStateHash,
            createdAt: archive.createdAt,
            downloadUrl: archive.downloadUrl,
            runtimeSchemaFingerprint: archive.runtimeSchemaFingerprint,
          },
          200
        );
      })
    )
  );
}

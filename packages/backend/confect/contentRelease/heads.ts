import { DatabaseReader } from "@confect/server";
import {
  type ContentHead,
  HeadPageRequestSchema,
  HeadPageSchema,
} from "@nakafa/aksara-contracts/release/head";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { loadReadableSnapshot } from "@repo/backend/confect/contentRelease/snapshot";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { resolveContentHead } from "@repo/backend/content/publication/projection";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Schema } from "effect";

/** Decodes one bounded active-head request into the exact shared contract. */
export const decodeRequest = Effect.fn("contentRelease.decodeHeadPage")(
  function* (input: unknown) {
    return yield* Schema.decodeUnknownEffect(HeadPageRequestSchema)(input, {
      onExcessProperty: "error",
    }).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_LIMIT",
            message: "Content head page request violates its bounded contract.",
          })
      )
    );
  }
);
/** Proves the requested release is an exact active or verified snapshot. */
export const snapshotSequence = Effect.fn("contentRelease.snapshotSequence")(
  function* (ctx: QueryCtx, releaseId: string, manifestHash: string) {
    const { release } = yield* loadReadableSnapshot(
      ctx,
      releaseId,
      manifestHash
    );
    return release.sequence;
  }
);
/** Reads one canonical family directory page from an immutable sequence. */
export const headPageProgram = Effect.fn("contentRelease.headPage")(function* (
  ctx: QueryCtx,
  input: unknown
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const request = yield* decodeRequest(input);
  const sequence = yield* snapshotSequence(
    ctx,
    request.activeReleaseId,
    request.activeManifestHash
  );
  const stored = yield* database
    .table("contentKeys")
    .index(
      "by_family_and_contentKey_and_artifactLocale",
      (query) => query.eq("family", request.family),
      "asc"
    )
    .paginate({
      cursor: request.cursor,
      maximumRowsRead: request.limit,
      numItems: request.limit,
    })
    .pipe(Effect.orDie);
  const heads: ContentHead[] = [];
  for (const key of stored.page) {
    const head = yield* resolveContentHead(
      key.contentKey,
      key.artifactLocale,
      sequence
    ).pipe(Effect.provide(convexPublicationLayer(ctx)));
    if (head) {
      heads.push(head);
    }
  }
  const page = {
    activeManifestHash: request.activeManifestHash,
    activeReleaseId: request.activeReleaseId,
    cursor: request.cursor,
    done: stored.isDone,
    family: request.family,
    heads,
    nextCursor: stored.isDone ? null : stored.continueCursor,
  };
  return yield* Schema.decodeUnknownEffect(HeadPageSchema)(page, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Content head page for ${request.activeReleaseId} is inconsistent.`,
        })
    ),
    Effect.map((decoded) => ({
      ...decoded,
      heads: decoded.heads.map(({ publicPath, ...head }) => ({
        ...head,
        ...(publicPath === undefined
          ? {}
          : {
              publicPath,
            }),
      })),
    }))
  );
});

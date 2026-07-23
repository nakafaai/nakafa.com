import {
  type HeadPage,
  HeadPageRequestSchema,
  HeadPageSchema,
  type MaterialHead,
} from "@nakafa/aksara-contracts/release/head";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { resolveMaterialHead } from "@repo/backend/convex/contentRelease/catalog";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { loadReadableSnapshot } from "@repo/backend/convex/contentRelease/snapshot";
import { headPageValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

/** Decodes one bounded active-head request into the exact shared contract. */
const decodeRequest = Effect.fn("contentRelease.decodeHeadPage")(function* (
  input: unknown
) {
  return yield* Schema.decodeUnknown(HeadPageRequestSchema)(input, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_LIMIT",
          message: "Material head page request violates its bounded contract.",
        })
    )
  );
});

/** Proves the requested release is an exact active or verified snapshot. */
const snapshotSequence = Effect.fn("contentRelease.snapshotSequence")(
  function* (ctx: QueryCtx, releaseId: string, manifestHash: string) {
    const { release } = yield* loadReadableSnapshot(
      ctx,
      releaseId,
      manifestHash
    );
    return release.sequence;
  }
);

/** Reads one canonical material directory page from an immutable sequence. */
const headPageProgram = Effect.fn("contentRelease.headPage")(function* (
  ctx: QueryCtx,
  input: unknown
) {
  const request = yield* decodeRequest(input);
  const sequence = yield* snapshotSequence(
    ctx,
    request.activeReleaseId,
    request.activeManifestHash
  );
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentKeys")
      .withIndex("by_family_and_contentKey_and_locale", (query) =>
        query.eq("family", request.family)
      )
      .order("asc")
      .paginate({
        cursor: request.cursor,
        maximumRowsRead: request.limit,
        numItems: request.limit,
      })
  );
  const heads: MaterialHead[] = [];
  for (const key of stored.page) {
    const head = yield* resolveMaterialHead(
      ctx,
      key.contentKey,
      key.locale,
      sequence
    );
    if (head) {
      heads.push(head);
    }
  }
  const page: HeadPage = {
    activeManifestHash: request.activeManifestHash,
    activeReleaseId: request.activeReleaseId,
    cursor: request.cursor,
    done: stored.isDone,
    family: request.family,
    heads,
    nextCursor: stored.isDone ? null : stored.continueCursor,
  };
  return yield* Schema.decodeUnknown(HeadPageSchema)(page, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Material head page for ${request.activeReleaseId} is inconsistent.`,
        })
    ),
    Effect.map((decoded) => ({ ...decoded, heads: [...decoded.heads] }))
  );
});

/** Returns one exact active material inventory page for source diffing. */
export const page = internalQuery({
  args: {
    activeManifestHash: v.string(),
    activeReleaseId: v.string(),
    cursor: v.union(v.string(), v.null()),
    family: v.literal("material"),
    limit: v.number(),
  },
  returns: headPageValidator,
  handler: (ctx, args) => runConvexProgram(headPageProgram(ctx, args)),
});

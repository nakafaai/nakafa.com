import { PublicationSource } from "@repo/backend/content/publication/source";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  loadRelease,
  loadRouteBinding,
  loadState,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { Effect, Layer, Option } from "effect";

/** Keeps publication reads on their existing bounded native Convex indexes. */
export const convexPublicationLayer = (ctx: MutationCtx | QueryCtx) =>
  Layer.succeed(PublicationSource, {
    state: loadState(ctx).pipe(Effect.map(Option.fromNullishOr)),
    release: Effect.fn("publication.convex.release")((releaseId) =>
      loadRelease(ctx, releaseId)
    ),
    version: Effect.fn("publication.convex.version")(
      (contentKey, artifactLocale, sequence) =>
        loadVersion(ctx, contentKey, artifactLocale, sequence).pipe(
          Effect.map(Option.fromNullishOr)
        )
    ),
    binding: Effect.fn("publication.convex.binding")(
      (appLocale, publicPath, sequence) =>
        loadRouteBinding(ctx, appLocale, publicPath, sequence).pipe(
          Effect.map(Option.fromNullishOr)
        )
    ),
    artifact: Effect.fn("publication.convex.artifact")((artifactHash) =>
      Effect.promise(() =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (index) =>
            index.eq("artifactHash", artifactHash)
          )
          .unique()
      ).pipe(Effect.map(Option.fromNullishOr))
    ),
    snapshot: Effect.fn("publication.convex.snapshot")((family, snapshotId) =>
      loadSnapshot(ctx, family, snapshotId).pipe(
        Effect.map(Option.fromNullishOr)
      )
    ),
    pageKeys: Effect.fn("publication.convex.pageKeys")(
      (appLocale, sequence, limit) =>
        Effect.promise(() =>
          ctx.db
            .query("contentKeys")
            .withIndex(
              "by_family_and_artifactLocale_and_createdSequence_and_contentKey",
              (index) =>
                index
                  .eq("family", "page")
                  .eq("artifactLocale", appLocale)
                  .lte("createdSequence", sequence)
            )
            .take(limit)
        )
    ),
  });

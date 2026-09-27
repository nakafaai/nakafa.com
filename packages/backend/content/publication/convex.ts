import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  loadRelease,
  loadRouteBinding,
  loadState,
  loadVersion,
} from "@repo/backend/confect/contentRelease/model";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import { PublicationSource } from "@repo/backend/content/publication/source";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
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
    artifact: Effect.fn("publication.convex.artifact")(
      function* (artifactHash) {
        const database = DatabaseReader.make(databaseSchema, ctx.db);
        return yield* database
          .table("contentArtifacts")
          .get("by_artifactHash", artifactHash)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie,
            Effect.map(Option.fromNullishOr)
          );
      }
    ),
    snapshot: Effect.fn("publication.convex.snapshot")((family, snapshotId) =>
      loadSnapshot(ctx, family, snapshotId).pipe(
        Effect.map(Option.fromNullishOr)
      )
    ),
    pageKeys: Effect.fn("publication.convex.pageKeys")(
      function* (appLocale, sequence, limit) {
        const database = DatabaseReader.make(databaseSchema, ctx.db);
        return yield* database
          .table("contentKeys")
          .index(
            "by_family_and_artifactLocale_and_createdSequence_and_contentKey",
            (index) =>
              index
                .eq("family", "page")
                .eq("artifactLocale", appLocale)
                .lte("createdSequence", sequence)
          )
          .take(limit)
          .pipe(Effect.orDie);
      }
    ),
  });

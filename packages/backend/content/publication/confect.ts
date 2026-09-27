import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadRelease,
  loadRouteBinding,
  loadState,
  loadVersion,
} from "@repo/backend/confect/contentRelease/model";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import { PublicationSource } from "@repo/backend/content/publication/source";
import { Effect, Layer, Option } from "effect";

/** Keeps publication reads on their existing bounded native Convex indexes. */
export const publicationLayer = Layer.effect(
  PublicationSource,
  Effect.gen(function* () {
    const database = yield* DatabaseReader;
    return PublicationSource.of({
      state: loadState().pipe(
        Effect.map(Option.fromNullishOr),
        Effect.provideService(DatabaseReader, database)
      ),
      release: Effect.fn("publication.database.release")(
        (releaseId) => loadRelease(releaseId),
        Effect.provideService(DatabaseReader, database)
      ),
      version: Effect.fn("publication.database.version")(
        (contentKey, artifactLocale, sequence) =>
          loadVersion(contentKey, artifactLocale, sequence).pipe(
            Effect.map(Option.fromNullishOr)
          ),
        Effect.provideService(DatabaseReader, database)
      ),
      binding: Effect.fn("publication.database.binding")(
        (appLocale, publicPath, sequence) =>
          loadRouteBinding(appLocale, publicPath, sequence).pipe(
            Effect.map(Option.fromNullishOr)
          ),
        Effect.provideService(DatabaseReader, database)
      ),
      artifact: Effect.fn("publication.database.artifact")(
        function* (artifactHash) {
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
      snapshot: Effect.fn("publication.database.snapshot")(
        (family, snapshotId) =>
          loadSnapshot(family, snapshotId).pipe(
            Effect.map(Option.fromNullishOr)
          ),
        Effect.provideService(DatabaseReader, database)
      ),
      pageKeys: Effect.fn("publication.database.pageKeys")(
        function* (appLocale, sequence, limit) {
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
  })
);

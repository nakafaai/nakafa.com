import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { familyForProjection } from "@nakafa/aksara-contracts/projection/spec";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/confect/contentRelease/model";
import { decodeProjectionJson } from "@repo/backend/confect/contentRelease/parse";
import { catalogRelease } from "@repo/backend/confect/contentRelease/proof/catalog";
import type { routeCatalogValidator } from "@repo/backend/confect/contentRelease/proof/routes.spec";
import {
  PROOF_PAGE_BYTES,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { Effect } from "effect";
export type RouteCatalogPage = typeof routeCatalogValidator.Type;

/** Validates one bounded active-route directory page at a frozen sequence. */
export const routeProgram = Effect.fn("contentRelease.routeCatalogPage")(
  function* (releaseId: string, cursor: null | string) {
    const database = yield* DatabaseReader;
    const release = yield* catalogRelease(releaseId);
    const stored = yield* database
      .table("contentPaths")
      .index(
        "by_createdSequence_and_appLocale_and_publicPath",
        (query) => query.lte("createdSequence", release.sequence),
        "asc"
      )
      .paginate({
        cursor,
        maximumBytesRead: PROOF_PAGE_BYTES,
        maximumRowsRead: ROUTE_CATALOG_PAGE_LIMIT,
        numItems: ROUTE_CATALOG_PAGE_LIMIT,
      })
      .pipe(Effect.orDie);
    for (const path of stored.page) {
      const binding = yield* loadRouteBinding(
        path.appLocale,
        path.publicPath,
        release.sequence
      );
      if (!binding || binding.operation === "delete") {
        continue;
      }
      if (!binding.contentKey) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Route ${path.appLocale}/${path.publicPath} lost its content key.`
        );
      }
      const head = yield* loadVersion(
        binding.contentKey,
        ArtifactLocaleSchema.make(path.appLocale),
        release.sequence
      );
      if (head?.operation !== "upsert") {
        return yield* releaseFail(
          "CONTENT_RELEASE_ROUTE",
          `Route ${path.appLocale}/${path.publicPath} targets missing content.`
        );
      }
      if (!head.projectionJson) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Route ${path.appLocale}/${path.publicPath} lost its projection.`
        );
      }
      const projection = yield* decodeProjectionJson(head.projectionJson);
      if (projection.kind === "question-body") {
        return yield* releaseFail(
          "CONTENT_RELEASE_ROUTE",
          `Route ${path.appLocale}/${path.publicPath} targets a protected question body.`
        );
      }
      if (
        projection.contentKey !== binding.contentKey ||
        familyForProjection(projection) !== head.family ||
        projection.appLocale !== path.appLocale ||
        projection.publicPath !== path.publicPath
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_ROUTE",
          `Route ${path.appLocale}/${path.publicPath} disagrees with its projection.`
        );
      }
      if (
        head.sequence === binding.sequence &&
        head.releaseId !== binding.releaseId
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Route ${path.appLocale}/${path.publicPath} disagrees at one sequence.`
        );
      }
    }
    return {
      checked: stored.page.length,
      done: stored.isDone,
      nextCursor: stored.isDone ? null : stored.continueCursor,
    } satisfies RouteCatalogPage;
  }
);

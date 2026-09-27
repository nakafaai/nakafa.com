import type { ContentRouteItem } from "@nakafa/aksara-contracts/release/route/spec";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadIdentityItem,
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/confect/contentRelease/model";
import { decodeItemJson } from "@repo/backend/confect/contentRelease/parse";
import { Effect } from "effect";

/** Creates one permanent route directory entry without changing identity. */
const ensureContentPath = Effect.fn("contentRelease.ensureContentPath")(
  function* (route: ContentRouteItem, sequence: number) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const existing = yield* database
      .table("contentPaths")
      .get(
        "by_appLocale_and_publicPath",
        route.change.appLocale,
        route.change.publicPath
      )
      .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
    if (existing) {
      return;
    }
    yield* writer.table("contentPaths").insert({
      appLocale: route.change.appLocale,
      createdSequence: sequence,
      publicPath: route.change.publicPath,
    });
  },
  Effect.orDie
);

/** Proves a bound content identity exists in the release result snapshot. */
const validateBoundContent = Effect.fn("contentRelease.validateBoundContent")(
  function* (
    releaseId: string,
    sequence: number | undefined,
    route: ContentRouteItem
  ) {
    if (route.change.operation === "delete") {
      return;
    }
    const staged = yield* loadIdentityItem(
      releaseId,
      route.change.contentKey,
      route.change.appLocale
    );
    if (staged) {
      const item = yield* decodeItemJson(staged.itemJson);
      if (item.change.operation === "upsert") {
        return;
      }
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Route ${route.change.appLocale}/${route.change.publicPath} binds deleted content.`
      );
    }
    if (sequence !== undefined) {
      const prior = yield* loadVersion(
        route.change.contentKey,
        route.change.appLocale,
        sequence
      );
      if (prior?.operation === "upsert") {
        return;
      }
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Route ${route.change.appLocale}/${route.change.publicPath} has no content head.`
    );
  }
);

/** Stores one immutable route version after deriving its prior owner. */
export const stageRouteVersion = Effect.fn("contentRelease.stageRouteVersion")(
  function* (
    route: ContentRouteItem,
    routeJson: string,
    batchIndex: number,
    batchHash: string,
    sequence: number,
    priorSequence: number | undefined
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const atIndex = yield* database
      .table("contentBindings")
      .get("by_releaseId_and_index", route.releaseId, route.index)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const atPath = yield* database
      .table("contentBindings")
      .get(
        "by_releaseId_and_appLocale_and_publicPath",
        route.releaseId,
        route.change.appLocale,
        route.change.publicPath
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (atIndex || atPath) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Release ${route.releaseId} repeats one route identity.`
      );
    }
    const prior =
      priorSequence === undefined
        ? null
        : yield* loadRouteBinding(
            route.change.appLocale,
            route.change.publicPath,
            priorSequence
          );
    if (route.change.operation === "delete" && prior?.operation !== "bind") {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Route ${route.change.appLocale}/${route.change.publicPath} has no prior owner.`
      );
    }
    if (
      route.change.operation === "bind" &&
      prior?.operation === "bind" &&
      prior.contentKey === route.change.contentKey
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Route ${route.change.appLocale}/${route.change.publicPath} keeps its owner.`
      );
    }
    yield* validateBoundContent(route.releaseId, priorSequence, route);
    yield* ensureContentPath(route, sequence);
    const contentKey =
      route.change.operation === "bind"
        ? route.change.contentKey
        : prior?.contentKey;
    if (contentKey === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${route.change.appLocale}/${route.change.publicPath} lost its prior content identity.`
      );
    }
    const row = {
      appLocale: route.change.appLocale,
      batchHash,
      batchIndex,
      contentKey,
      index: route.index,
      operation: route.change.operation,
      publicPath: route.change.publicPath,
      releaseId: route.releaseId,
      routeJson,
      sequence,
    };
    yield* ensureDocumentSize(
      `Release route ${route.index}`,
      row,
      READ_MODEL_DOCUMENT_LIMIT
    );
    yield* writer.table("contentBindings").insert(row).pipe(Effect.orDie);
  }
);

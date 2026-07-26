import type { ContentRouteItem } from "@nakafa/aksara-contracts/release/route";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadIdentityItem,
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { decodeItemJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

/** Creates one permanent route directory entry without changing identity. */
const ensureContentPath = Effect.fn("contentRelease.ensureContentPath")(
  function* (ctx: MutationCtx, route: ContentRouteItem, sequence: number) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("contentPaths")
        .withIndex("by_locale_and_publicPath", (query) =>
          query
            .eq("locale", route.change.locale)
            .eq("publicPath", route.change.publicPath)
        )
        .unique()
    );
    if (existing) {
      return;
    }
    yield* Effect.promise(() =>
      ctx.db.insert("contentPaths", {
        createdSequence: sequence,
        locale: route.change.locale,
        publicPath: route.change.publicPath,
      })
    );
  }
);

/** Proves a bound content identity exists in the release result snapshot. */
const validateBoundContent = Effect.fn("contentRelease.validateBoundContent")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    sequence: number | undefined,
    route: ContentRouteItem
  ) {
    if (route.change.operation === "delete") {
      return;
    }
    const staged = yield* loadIdentityItem(
      ctx,
      releaseId,
      route.change.contentKey,
      route.change.locale
    );
    if (staged) {
      const item = yield* decodeItemJson(staged.itemJson);
      if (item.change.operation === "upsert") {
        return;
      }
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Route ${route.change.locale}/${route.change.publicPath} binds deleted content.`
      );
    }
    if (sequence !== undefined) {
      const prior = yield* loadVersion(
        ctx,
        route.change.contentKey,
        route.change.locale,
        sequence
      );
      if (prior?.operation === "upsert") {
        return;
      }
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Route ${route.change.locale}/${route.change.publicPath} has no content head.`
    );
  }
);

/** Stores one immutable route version after deriving its prior owner. */
export const stageRouteVersion = Effect.fn("contentRelease.stageRouteVersion")(
  function* (
    ctx: MutationCtx,
    route: ContentRouteItem,
    routeJson: string,
    batchIndex: number,
    batchHash: string,
    sequence: number,
    priorSequence: number | undefined
  ) {
    const atIndex = yield* Effect.promise(() =>
      ctx.db
        .query("contentBindings")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", route.releaseId).eq("index", route.index)
        )
        .unique()
    );
    const atPath = yield* Effect.promise(() =>
      ctx.db
        .query("contentBindings")
        .withIndex("by_releaseId_and_locale_and_publicPath", (query) =>
          query
            .eq("releaseId", route.releaseId)
            .eq("locale", route.change.locale)
            .eq("publicPath", route.change.publicPath)
        )
        .unique()
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
            ctx,
            route.change.locale,
            route.change.publicPath,
            priorSequence
          );
    if (route.change.operation === "delete" && prior?.operation !== "bind") {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Route ${route.change.locale}/${route.change.publicPath} has no prior owner.`
      );
    }
    if (
      route.change.operation === "bind" &&
      prior?.operation === "bind" &&
      prior.contentKey === route.change.contentKey
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Route ${route.change.locale}/${route.change.publicPath} keeps its owner.`
      );
    }
    yield* validateBoundContent(ctx, route.releaseId, priorSequence, route);
    yield* ensureContentPath(ctx, route, sequence);
    const row = {
      batchHash,
      batchIndex,
      contentKey:
        route.change.operation === "bind"
          ? route.change.contentKey
          : prior?.contentKey,
      index: route.index,
      locale: route.change.locale,
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
    yield* Effect.promise(() => ctx.db.insert("contentBindings", row));
  }
);

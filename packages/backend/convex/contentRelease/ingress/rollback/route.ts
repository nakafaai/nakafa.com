"use node";
import {
  type RoutePage,
  RoutePageSchema,
  type RouteRollbackRecord,
} from "@nakafa/aksara-contracts/release/route/page";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type {
  ReadContext,
  RouteRequest,
} from "@repo/backend/convex/contentRelease/ingress/rollback/request";
import { ROUTE_CATALOG_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";
import { Effect, Schema } from "effect";

interface RollbackArgs extends DefaultFunctionArgs {
  readonly afterIndex: number;
  readonly limit: number;
  readonly rollbackOf: string;
  readonly rollbackOfManifestHash: string;
}

const routeReference = makeFunctionReference<"query", RollbackArgs, string>(
  "contentRelease/rollback:prepareRoutes"
);

/** Decodes one canonical route page through its exact current schema. */
const decodePage = Effect.fn("contentRelease.decodeRollbackRoutePage")(
  function* (source: string) {
    const unknownPage = yield* Effect.try({
      catch: () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Route rollback query page is not valid JSON.",
        }),
      try: (): unknown => JSON.parse(source),
    });
    return yield* Schema.decodeUnknownEffect(RoutePageSchema)(unknownPage, {
      onExcessProperty: "error",
    }).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Route rollback query page violates its exact contract.",
          })
      )
    );
  }
);

/** Creates one coherent route page from already validated records. */
function makePage(
  request: RouteRequest,
  total: number,
  records: readonly RouteRollbackRecord[]
): RoutePage {
  const nextIndex = records.at(-1)?.current.index ?? request.afterIndex;
  return {
    done: nextIndex === total - 1,
    nextIndex,
    records,
    rollbackOf: request.rollbackOf,
    rollbackOfManifestHash: request.rollbackOfManifestHash,
    total,
  };
}

/** Requires one route query chunk to continue the exact aggregate cursor. */
const validateChunk = Effect.fn("contentRelease.validateRouteChunk")(function* (
  chunk: RoutePage,
  request: RouteRequest,
  afterIndex: number,
  limit: number,
  total: number
) {
  const firstIndex = chunk.records[0]?.current.index ?? afterIndex + 1;
  if (
    chunk.rollbackOf !== request.rollbackOf ||
    chunk.rollbackOfManifestHash !== request.rollbackOfManifestHash ||
    chunk.total !== total ||
    chunk.records.length > limit ||
    firstIndex !== afterIndex + 1
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route rollback source ${request.rollbackOf} returned a mismatched query chunk.`
    );
  }
});

/** Aggregates safe route query transactions into one external page. */
export const readRoutePage = Effect.fn("contentRelease.readRollbackRoutePage")(
  function* (ctx: ReadContext, request: RouteRequest, total: number) {
    if (request.afterIndex >= total) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Route cursor ${request.afterIndex} exceeds release ${request.rollbackOf}.`
      );
    }
    const records: RouteRollbackRecord[] = [];
    let afterIndex = request.afterIndex;
    while (records.length < request.limit && afterIndex < total - 1) {
      const limit = Math.min(
        ROUTE_CATALOG_PAGE_LIMIT,
        request.limit - records.length
      );
      const source = yield* callInternal(() =>
        ctx.runQuery(routeReference, {
          afterIndex,
          limit,
          rollbackOf: request.rollbackOf,
          rollbackOfManifestHash: request.rollbackOfManifestHash,
        })
      );
      const chunk = yield* decodePage(source);
      yield* validateChunk(chunk, request, afterIndex, limit, total);
      records.push(...chunk.records);
      afterIndex = chunk.nextIndex;
      if (chunk.done) {
        break;
      }
    }
    return makePage(request, total, records);
  }
);

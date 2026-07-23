import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  canonicalizeRollbackPage,
  MAX_ROLLBACK_PAGE_RECORDS,
  type RollbackPage,
  RollbackPageRequestSchema,
  type RollbackRecord,
} from "@nakafa/aksara-contracts/release/rollback";
import {
  canonicalizeRoutePage,
  MAX_ROUTE_PAGE_RECORDS,
  type RoutePage,
  RoutePageRequestSchema,
  type RouteRollbackRecord,
} from "@nakafa/aksara-contracts/release/route-page";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { loadRouteBinding } from "@repo/backend/convex/contentRelease/model";
import { decodeRouteJson } from "@repo/backend/convex/contentRelease/parse";
import { rollbackRecord } from "@repo/backend/convex/contentRelease/rollback/state";
import { loadReadableSnapshot } from "@repo/backend/convex/contentRelease/snapshot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const ROLLBACK_PAGE_BYTES = 4 * 1024 * 1024;

/** Proves one release is an exact active or verified-candidate rollback source. */
const rollbackSource = Effect.fn("contentRelease.rollbackSource")(function* (
  ctx: QueryCtx,
  releaseId: string,
  manifestHash: string
) {
  return yield* loadReadableSnapshot(ctx, releaseId, manifestHash);
});

/** Creates one bounded body-bearing rollback page. */
function makeRollbackPage(
  request: typeof RollbackPageRequestSchema.Type,
  total: number,
  records: readonly RollbackRecord[]
): RollbackPage {
  const nextIndex = records.at(-1)?.index ?? request.afterIndex;
  return {
    done: nextIndex === total - 1,
    nextIndex,
    records,
    rollbackOf: request.rollbackOf,
    rollbackOfManifestHash: request.rollbackOfManifestHash,
    total,
  };
}

/** Reads one bounded exact prior-state page from the active release. */
const rollbackProgram = Effect.fn("contentRelease.prepareRollback")(function* (
  ctx: QueryCtx,
  input: unknown
) {
  const request = yield* Schema.decodeUnknown(RollbackPageRequestSchema)(
    input
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_LIMIT",
          message: `Rollback pages require 1-${MAX_ROLLBACK_PAGE_RECORDS} records.`,
        })
    )
  );
  const { signed } = yield* rollbackSource(
    ctx,
    request.rollbackOf,
    request.rollbackOfManifestHash
  );
  const total = signed.manifest.itemCount;
  if (request.afterIndex >= total) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Rollback cursor ${request.afterIndex} exceeds release ${request.rollbackOf}.`
    );
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_index", (query) =>
        query
          .eq("releaseId", request.rollbackOf)
          .gt("index", request.afterIndex)
      )
      .take(request.limit)
  );
  const records: RollbackRecord[] = [];
  for (const [offset, row] of rows.entries()) {
    if (row.index !== request.afterIndex + offset + 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback source ${request.rollbackOf} is not contiguous.`
      );
    }
    const record = yield* rollbackRecord(ctx, row);
    const candidate = makeRollbackPage(request, total, [...records, record]);
    if (
      new TextEncoder().encode(canonicalizeRollbackPage(candidate)).byteLength >
      ROLLBACK_PAGE_BYTES
    ) {
      if (records.length === 0) {
        return yield* releaseFail(
          "CONTENT_RELEASE_LIMIT",
          `Rollback transition ${request.rollbackOf}/${row.index} exceeds the page byte ceiling.`
        );
      }
      break;
    }
    records.push(record);
  }
  return canonicalizeRollbackPage(makeRollbackPage(request, total, records));
});

/** Resolves the owner immediately before one signed route change. */
const priorRouteOwner = Effect.fn("contentRelease.priorRouteOwner")(function* (
  ctx: QueryCtx,
  row: Doc<"contentBindings">,
  baseSequence: number
) {
  const prior = yield* loadRouteBinding(
    ctx,
    row.locale,
    row.publicPath,
    baseSequence
  );
  if (prior?.operation !== "bind") {
    return null;
  }
  return yield* Schema.decodeUnknown(ContentKeySchema)(prior.contentKey).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Prior route ${row.locale}/${row.publicPath} lost its content identity.`,
        })
    )
  );
});

/** Reads one bounded exact prior-owner page from the active release. */
const routeProgram = Effect.fn("contentRelease.prepareRouteRollback")(
  function* (ctx: QueryCtx, input: unknown) {
    const request = yield* Schema.decodeUnknown(RoutePageRequestSchema)(
      input
    ).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_LIMIT",
            message: `Route pages require 1-${MAX_ROUTE_PAGE_RECORDS} records.`,
          })
      )
    );
    const { baseSequence, signed } = yield* rollbackSource(
      ctx,
      request.rollbackOf,
      request.rollbackOfManifestHash
    );
    const total = signed.manifest.routeCount;
    if (request.afterIndex >= total) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Route cursor ${request.afterIndex} exceeds release ${request.rollbackOf}.`
      );
    }
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("contentBindings")
        .withIndex("by_releaseId_and_index", (query) =>
          query
            .eq("releaseId", request.rollbackOf)
            .gt("index", request.afterIndex)
        )
        .take(request.limit)
    );
    const records: RouteRollbackRecord[] = [];
    for (const [offset, row] of rows.entries()) {
      if (row.index !== request.afterIndex + offset + 1) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Route rollback source ${request.rollbackOf} is not contiguous.`
        );
      }
      records.push({
        current: yield* decodeRouteJson(row.routeJson),
        priorContentKey: yield* priorRouteOwner(ctx, row, baseSequence),
      });
    }
    const nextIndex = records.at(-1)?.current.index ?? request.afterIndex;
    const page: RoutePage = {
      done: nextIndex === total - 1,
      nextIndex,
      records,
      rollbackOf: request.rollbackOf,
      rollbackOfManifestHash: request.rollbackOfManifestHash,
      total,
    };
    return canonicalizeRoutePage(page);
  }
);

/** Returns one canonical bounded body rollback page. */
export const prepareRollback = internalQuery({
  args: {
    afterIndex: v.number(),
    limit: v.number(),
    rollbackOf: v.string(),
    rollbackOfManifestHash: v.string(),
  },
  returns: v.string(),
  handler: (ctx, args) => runConvexProgram(rollbackProgram(ctx, args)),
});

/** Returns one canonical bounded route-owner rollback page. */
export const prepareRoutes = internalQuery({
  args: {
    afterIndex: v.number(),
    limit: v.number(),
    rollbackOf: v.string(),
    rollbackOfManifestHash: v.string(),
  },
  returns: v.string(),
  handler: (ctx, args) => runConvexProgram(routeProgram(ctx, args)),
});

import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  canonicalizeRollbackPage,
  MAX_ROLLBACK_PAGE_BYTES,
  MAX_ROLLBACK_PAGE_RECORDS,
  type RollbackPage,
  RollbackPageRequestSchema,
  type RollbackRecord,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import {
  MAX_ROUTE_PAGE_RECORDS,
  type RoutePage,
  RoutePageRequestSchema,
  type RouteRollbackRecord,
} from "@nakafa/aksara-contracts/release/route/page";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { loadRouteBinding } from "@repo/backend/confect/contentRelease/model";
import { decodeRouteJson } from "@repo/backend/confect/contentRelease/parse";
import { rollbackRecord } from "@repo/backend/confect/contentRelease/rollback/state";
import { loadReadableSnapshot } from "@repo/backend/confect/contentRelease/snapshot";
import {
  RELEASE_PAGE_LIMIT,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Schema } from "effect";

/** Proves one release is an exact active or verified-candidate rollback source. */
const rollbackSource = Effect.fn("contentRelease.rollbackSource")(function* (
  releaseId: string,
  manifestHash: string
) {
  return yield* loadReadableSnapshot(releaseId, manifestHash);
});
/** Creates one bounded body-bearing rollback page. */
export function makeRollbackPage(
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
export const rollbackProgram = Effect.fn("contentRelease.prepareRollback")(
  function* (input: unknown) {
    const database = yield* DatabaseReader;
    const request = yield* Schema.decodeUnknownEffect(
      RollbackPageRequestSchema
    )(input).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_LIMIT",
            message: `Rollback pages require 1-${MAX_ROLLBACK_PAGE_RECORDS} records.`,
          })
      )
    );
    if (request.limit > RELEASE_PAGE_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Rollback query pages require 1-${RELEASE_PAGE_LIMIT} records.`
      );
    }
    const { signed } = yield* rollbackSource(
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
    const rowPage = yield* database
      .table("contentItems")
      .index("by_releaseId_and_index", (query) =>
        query
          .eq("releaseId", request.rollbackOf)
          .gt("index", request.afterIndex)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: MAX_ROLLBACK_PAGE_BYTES,
        maximumRowsRead: request.limit,
        numItems: request.limit,
      })
      .pipe(Effect.orDie);
    let records: RollbackRecord[] = [];
    for (const [offset, row] of rowPage.page.entries()) {
      if (row.index !== request.afterIndex + offset + 1) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Rollback source ${request.rollbackOf} is not contiguous.`
        );
      }
      const record = yield* rollbackRecord(row);
      const candidate = makeRollbackPage(request, total, [...records, record]);
      if (
        new TextEncoder().encode(canonicalizeRollbackPage(candidate))
          .byteLength > MAX_ROLLBACK_PAGE_BYTES
      ) {
        if (records.length === 0) {
          return yield* releaseFail(
            "CONTENT_RELEASE_LIMIT",
            `Rollback transition ${request.rollbackOf}/${row.index} exceeds the page byte ceiling.`
          );
        }
        break;
      }
      records = Arr.append(records, record);
    }
    return canonicalizeRollbackPage(makeRollbackPage(request, total, records));
  }
);
/** Resolves the owner immediately before one signed route change. */
const priorRouteOwner = Effect.fn("contentRelease.priorRouteOwner")(function* (
  row: Docs["contentBindings"],
  baseSequence: number
) {
  const prior = yield* loadRouteBinding(
    row.appLocale,
    row.publicPath,
    baseSequence
  );
  if (prior?.operation !== "bind") {
    return null;
  }
  return yield* Schema.decodeUnknownEffect(ContentKeySchema)(
    prior.contentKey
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Prior route ${row.appLocale}/${row.publicPath} lost its content identity.`,
        })
    )
  );
});
/** Reads one bounded exact prior-owner page from the active release. */
export const routeProgram = Effect.fn("contentRelease.prepareRouteRollback")(
  function* (input: unknown) {
    const database = yield* DatabaseReader;
    const request = yield* Schema.decodeUnknownEffect(RoutePageRequestSchema)(
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
    if (request.limit > ROUTE_CATALOG_PAGE_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Route rollback query pages require 1-${ROUTE_CATALOG_PAGE_LIMIT} records.`
      );
    }
    const { baseSequence, signed } = yield* rollbackSource(
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
    const rows = yield* database
      .table("contentBindings")
      .index("by_releaseId_and_index", (query) =>
        query
          .eq("releaseId", request.rollbackOf)
          .gt("index", request.afterIndex)
      )
      .take(request.limit)
      .pipe(Effect.orDie);
    let records: RouteRollbackRecord[] = [];
    for (const [offset, row] of rows.entries()) {
      if (row.index !== request.afterIndex + offset + 1) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Route rollback source ${request.rollbackOf} is not contiguous.`
        );
      }
      records = Arr.append(records, {
        current: yield* decodeRouteJson(row.routeJson),
        priorContentKey: yield* priorRouteOwner(row, baseSequence),
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
    return encodeJsonText(page);
  }
);

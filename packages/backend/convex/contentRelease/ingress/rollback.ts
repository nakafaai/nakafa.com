"use node";

import { verifySignedContentArtifactIntegrity } from "@nakafa/aksara-contracts/artifact/integrity";
import {
  canonicalizeRollbackPage,
  canonicalizeRollbackRecord,
  isRollbackUpsert,
  MAX_ROLLBACK_PAGE_BYTES,
  type RollbackPage,
  RollbackPageSchema,
  type RollbackRecord,
} from "@nakafa/aksara-contracts/release/rollback";
import {
  type RoutePage,
  RoutePageSchema,
  type RouteRollbackRecord,
} from "@nakafa/aksara-contracts/release/route-page";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  loadVerifiedRelease,
  matchManifest,
} from "@repo/backend/convex/contentRelease/ingress/current";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  RELEASE_PAGE_LIMIT,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";
import { Effect, Schema } from "effect";

type RollbackRequest = Extract<
  PublicationRequest,
  { readonly operation: "rollbackPage" | "routePage" }
>;
type ReadContext = Pick<ActionCtx, "runQuery">;

interface RollbackArgs extends DefaultFunctionArgs {
  readonly afterIndex: number;
  readonly limit: number;
  readonly rollbackOf: string;
  readonly rollbackOfManifestHash: string;
}

const rollbackReference = makeFunctionReference<"query", RollbackArgs, string>(
  "contentRelease/rollback:prepareRollback"
);
const routeRollbackReference = makeFunctionReference<
  "query",
  RollbackArgs,
  string
>("contentRelease/rollback:prepareRoutes");
const textEncoder = new TextEncoder();

/** Decodes one canonical stored page through its exact shared schema. */
const decodePage = Effect.fn("contentRelease.decodeRollbackPage")(function* <
  A,
  I,
>(source: string, schema: Schema.Schema<A, I, never>, label: string) {
  const unknownPage = yield* Effect.try({
    catch: () =>
      new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: `${label} is not valid JSON.`,
      }),
    try: (): unknown => JSON.parse(source),
  });
  return yield* Schema.decodeUnknown(schema)(unknownPage, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `${label} violates its exact contract.`,
        })
    )
  );
});

/** Creates one coherent aggregate page from already validated records. */
function makeRollbackPage(
  request: Extract<RollbackRequest, { readonly operation: "rollbackPage" }>,
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

/** Creates one coherent route page from already validated records. */
function makeRoutePage(
  request: Extract<RollbackRequest, { readonly operation: "routePage" }>,
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

/** Computes exact canonical bytes without repeatedly serializing prior records. */
function rollbackPageBytes(page: RollbackPage, recordBytes: number) {
  const wrapper = canonicalizeRollbackPage({ ...page, records: [] });
  const separators = Math.max(0, page.records.length - 1);
  return textEncoder.encode(wrapper).byteLength + recordBytes + separators;
}

/** Requires one query chunk to continue the exact aggregate cursor. */
const validateBodyChunk = Effect.fn("contentRelease.validateRollbackChunk")(
  function* (
    chunk: RollbackPage,
    request: Extract<RollbackRequest, { readonly operation: "rollbackPage" }>,
    afterIndex: number,
    limit: number,
    total: number
  ) {
    const firstIndex = chunk.records[0]?.index ?? afterIndex + 1;
    if (
      chunk.rollbackOf !== request.rollbackOf ||
      chunk.rollbackOfManifestHash !== request.rollbackOfManifestHash ||
      chunk.total !== total ||
      chunk.records.length > limit ||
      firstIndex !== afterIndex + 1
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback source ${request.rollbackOf} returned a mismatched query chunk.`
      );
    }
  }
);

/** Requires one route query chunk to continue the exact aggregate cursor. */
const validateRouteChunk = Effect.fn("contentRelease.validateRouteChunk")(
  function* (
    chunk: RoutePage,
    request: Extract<RollbackRequest, { readonly operation: "routePage" }>,
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
  }
);

/** Reauthenticates every body-bearing rollback state before external return. */
const verifyRollbackArtifacts = Effect.fn(
  "contentRelease.verifyRollbackArtifacts"
)(function* (page: RollbackPage) {
  for (const record of page.records) {
    for (const state of [record.current, record.prior]) {
      if (isRollbackUpsert(state)) {
        yield* verifySignedContentArtifactIntegrity(state.artifact).pipe(
          Effect.mapError(contractFailure)
        );
      }
    }
  }
  return page;
});

/** Aggregates safe query transactions into one byte-bounded wire page. */
const readBodyPage = Effect.fn("contentRelease.readRollbackBodyPage")(
  function* (
    ctx: ReadContext,
    request: Extract<RollbackRequest, { readonly operation: "rollbackPage" }>,
    total: number
  ) {
    if (request.afterIndex >= total) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Rollback cursor ${request.afterIndex} exceeds release ${request.rollbackOf}.`
      );
    }

    const records: RollbackRecord[] = [];
    let afterIndex = request.afterIndex;
    let recordBytes = 0;
    while (records.length < request.limit && afterIndex < total - 1) {
      const limit = Math.min(
        RELEASE_PAGE_LIMIT,
        request.limit - records.length
      );
      const source = yield* callInternal(() =>
        ctx.runQuery(rollbackReference, {
          afterIndex,
          limit,
          rollbackOf: request.rollbackOf,
          rollbackOfManifestHash: request.rollbackOfManifestHash,
        })
      );
      const chunk = yield* decodePage(
        source,
        RollbackPageSchema,
        "Rollback query page"
      );
      yield* validateBodyChunk(chunk, request, afterIndex, limit, total);

      for (const record of chunk.records) {
        const encodedBytes = textEncoder.encode(
          canonicalizeRollbackRecord(record)
        ).byteLength;
        records.push(record);
        const candidate = makeRollbackPage(request, total, records);
        const candidateBytes = recordBytes + encodedBytes;
        if (
          rollbackPageBytes(candidate, candidateBytes) > MAX_ROLLBACK_PAGE_BYTES
        ) {
          records.pop();
          if (records.length === 0) {
            return yield* releaseFail(
              "CONTENT_RELEASE_LIMIT",
              `Rollback transition ${request.rollbackOf}/${record.index} exceeds the page byte ceiling.`
            );
          }
          return yield* verifyRollbackArtifacts(
            makeRollbackPage(request, total, records)
          );
        }
        recordBytes = candidateBytes;
        afterIndex = record.index;
      }
      if (chunk.done) {
        break;
      }
    }
    return yield* verifyRollbackArtifacts(
      makeRollbackPage(request, total, records)
    );
  }
);

/** Aggregates safe route query transactions into one external page. */
const readRoutePage = Effect.fn("contentRelease.readRollbackRoutePage")(
  function* (
    ctx: ReadContext,
    request: Extract<RollbackRequest, { readonly operation: "routePage" }>,
    total: number
  ) {
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
        ctx.runQuery(routeRollbackReference, {
          afterIndex,
          limit,
          rollbackOf: request.rollbackOf,
          rollbackOfManifestHash: request.rollbackOfManifestHash,
        })
      );
      const chunk = yield* decodePage(
        source,
        RoutePageSchema,
        "Route rollback query page"
      );
      yield* validateRouteChunk(chunk, request, afterIndex, limit, total);
      records.push(...chunk.records);
      afterIndex = chunk.nextIndex;
      if (chunk.done) {
        break;
      }
    }
    return makeRoutePage(request, total, records);
  }
);

/** Reads one authenticated body or route rollback page. */
export const readRollback = Effect.fn("contentRelease.readRollback")(function* (
  ctx: ReadContext,
  request: RollbackRequest
) {
  const bundle = yield* loadVerifiedRelease(ctx, request.rollbackOf);
  yield* matchManifest(
    bundle.release,
    request.rollbackOfManifestHash,
    request.rollbackOf
  );
  if (request.operation === "rollbackPage") {
    return yield* readBodyPage(ctx, request, bundle.release.manifest.itemCount);
  }
  return yield* readRoutePage(ctx, request, bundle.release.manifest.routeCount);
});

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
} from "@nakafa/aksara-contracts/release/rollback/spec";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type {
  BodyRequest,
  ReadContext,
} from "@repo/backend/convex/contentRelease/ingress/rollback/request";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";
import { Effect, Schema } from "effect";

interface RollbackArgs extends DefaultFunctionArgs {
  readonly afterIndex: number;
  readonly limit: number;
  readonly rollbackOf: string;
  readonly rollbackOfManifestHash: string;
}

const rollbackReference = makeFunctionReference<"query", RollbackArgs, string>(
  "contentRelease/rollback:prepareRollback"
);
const textEncoder = new TextEncoder();

/** Decodes one canonical rollback page through its exact current schema. */
const decodePage = Effect.fn("contentRelease.decodeRollbackPage")(function* (
  source: string
) {
  const unknownPage = yield* Effect.try({
    catch: () =>
      new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Rollback query page is not valid JSON.",
      }),
    try: (): unknown => JSON.parse(source),
  });
  return yield* Schema.decodeUnknownEffect(RollbackPageSchema)(unknownPage, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Rollback query page violates its exact contract.",
        })
    )
  );
});

/** Creates one coherent aggregate page from already validated records. */
function makePage(
  request: BodyRequest,
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

/** Computes exact canonical bytes without repeatedly serializing prior records. */
function pageBytes(page: RollbackPage, recordBytes: number) {
  const wrapper = canonicalizeRollbackPage({ ...page, records: [] });
  const separators = Math.max(0, page.records.length - 1);
  return textEncoder.encode(wrapper).byteLength + recordBytes + separators;
}

/** Requires one query chunk to continue the exact aggregate cursor. */
const validateChunk = Effect.fn("contentRelease.validateRollbackChunk")(
  function* (
    chunk: RollbackPage,
    request: BodyRequest,
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

/** Reauthenticates every body-bearing rollback state before external return. */
const verifyArtifacts = Effect.fn("contentRelease.verifyRollbackArtifacts")(
  function* (page: RollbackPage) {
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
  }
);

/** Aggregates safe query transactions into one byte-bounded wire page. */
export const readBodyPage = Effect.fn("contentRelease.readRollbackBodyPage")(
  function* (ctx: ReadContext, request: BodyRequest, total: number) {
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
      const chunk = yield* decodePage(source);
      yield* validateChunk(chunk, request, afterIndex, limit, total);
      for (const record of chunk.records) {
        const encodedBytes = textEncoder.encode(
          canonicalizeRollbackRecord(record)
        ).byteLength;
        records.push(record);
        const candidate = makePage(request, total, records);
        const candidateBytes = recordBytes + encodedBytes;
        if (pageBytes(candidate, candidateBytes) > MAX_ROLLBACK_PAGE_BYTES) {
          records.pop();
          if (records.length === 0) {
            return yield* releaseFail(
              "CONTENT_RELEASE_LIMIT",
              `Rollback transition ${request.rollbackOf}/${record.index} exceeds the page byte ceiling.`
            );
          }
          return yield* verifyArtifacts(makePage(request, total, records));
        }
        recordBytes = candidateBytes;
        afterIndex = record.index;
      }
      if (chunk.done) {
        break;
      }
    }
    return yield* verifyArtifacts(makePage(request, total, records));
  }
);

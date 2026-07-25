"use node";

import { verifySignedContentArtifactIntegrity } from "@nakafa/aksara-contracts/artifact/integrity";
import {
  isRollbackUpsert,
  type RollbackPage,
  RollbackPageSchema,
} from "@nakafa/aksara-contracts/release/rollback";
import {
  type RoutePage,
  RoutePageSchema,
} from "@nakafa/aksara-contracts/release/route-page";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  loadVerifiedRelease,
  matchManifest,
  readCurrentPublication,
  readRecovery,
} from "@repo/backend/convex/contentRelease/ingress/current";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type {
  cleanupReceiptValidator,
  headPageValidator,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type ReadRequest = Extract<
  PublicationRequest,
  {
    readonly operation:
      | "cleanup"
      | "current"
      | "headPage"
      | "recovery"
      | "rollbackPage"
      | "routePage"
      | "status";
  }
>;

type ReadContext = Pick<ActionCtx, "runMutation" | "runQuery">;
interface RollbackArgs extends Record<string, number | string> {
  readonly afterIndex: number;
  readonly limit: number;
  readonly rollbackOf: string;
  readonly rollbackOfManifestHash: string;
}
type HeadPage = Infer<typeof headPageValidator>;
type Status = Infer<typeof statusValidator>;
type CleanupReceipt = Infer<typeof cleanupReceiptValidator>;

const rollbackReference = makeFunctionReference<"query", RollbackArgs, string>(
  "contentRelease/rollback:prepareRollback"
);
const routeRollbackReference = makeFunctionReference<
  "query",
  RollbackArgs,
  string
>("contentRelease/rollback:prepareRoutes");
const headPageReference = makeFunctionReference<
  "query",
  {
    activeManifestHash: string;
    activeReleaseId: string;
    cursor: null | string;
    family: HeadPage["family"];
    limit: number;
  },
  HeadPage
>("contentRelease/heads:page");
const statusReference = makeFunctionReference<
  "query",
  { manifestHash: string; releaseId: string },
  Status
>("contentRelease/status:getStatus");
const cleanupReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  CleanupReceipt
>("contentRelease/cleanup:cleanup");

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

/** Reads one authenticated body or route rollback page. */
const readRollback = Effect.fn("contentRelease.readRollback")(function* (
  ctx: ReadContext,
  request: Extract<ReadRequest, { operation: "rollbackPage" | "routePage" }>
) {
  const bundle = yield* loadVerifiedRelease(ctx, request.rollbackOf);
  yield* matchManifest(
    bundle.release,
    request.rollbackOfManifestHash,
    request.rollbackOf
  );
  const args = {
    afterIndex: request.afterIndex,
    limit: request.limit,
    rollbackOf: request.rollbackOf,
    rollbackOfManifestHash: request.rollbackOfManifestHash,
  };
  if (request.operation === "routePage") {
    const source = yield* callInternal(() =>
      ctx.runQuery(routeRollbackReference, args)
    );
    return yield* decodePage(source, RoutePageSchema, "Route rollback page");
  }
  const source = yield* callInternal(() =>
    ctx.runQuery(rollbackReference, args)
  );
  const page: RollbackPage = yield* decodePage(
    source,
    RollbackPageSchema,
    "Rollback page"
  );
  return yield* verifyRollbackArtifacts(page);
});

/** Executes one authenticated bounded publication read or cleanup request. */
export const readPublication = Effect.fn("contentRelease.readPublication")(
  function* (ctx: ReadContext, request: ReadRequest) {
    if (request.operation === "current") {
      return {
        ok: true,
        operation: request.operation,
        value: yield* readCurrentPublication(ctx),
      };
    }
    if (request.operation === "headPage") {
      const bundle = yield* loadVerifiedRelease(ctx, request.activeReleaseId);
      yield* matchManifest(
        bundle.release,
        request.activeManifestHash,
        request.activeReleaseId
      );
      const value = yield* callInternal(() =>
        ctx.runQuery(headPageReference, {
          activeManifestHash: request.activeManifestHash,
          activeReleaseId: request.activeReleaseId,
          cursor: request.cursor,
          family: request.family,
          limit: request.limit,
        })
      );
      return { ok: true, operation: request.operation, value };
    }
    if (request.operation === "recovery") {
      return {
        ok: true,
        operation: request.operation,
        value: yield* readRecovery(ctx, {
          recoveryId: request.recoveryId,
          releaseId: request.releaseId,
        }),
      };
    }
    if (request.operation === "status") {
      const value = yield* callInternal(() =>
        ctx.runQuery(statusReference, {
          manifestHash: request.manifestHash,
          releaseId: request.releaseId,
        })
      );
      if (value.phase !== "missing") {
        const bundle = yield* loadVerifiedRelease(ctx, request.releaseId);
        yield* matchManifest(
          bundle.release,
          request.manifestHash,
          request.releaseId
        );
      }
      return { ok: true, operation: request.operation, value };
    }
    if (
      request.operation === "rollbackPage" ||
      request.operation === "routePage"
    ) {
      const value: RollbackPage | RoutePage = yield* readRollback(ctx, request);
      return { ok: true, operation: request.operation, value };
    }
    const value = yield* callInternal(() =>
      ctx.runMutation(cleanupReference, {
        releaseId: request.releaseId,
      })
    );
    return { ok: true, operation: request.operation, value };
  }
);

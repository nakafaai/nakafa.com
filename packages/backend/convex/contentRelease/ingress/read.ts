"use node";

import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  loadVerifiedRelease,
  matchManifest,
  readCurrentPublication,
  readRecovery,
} from "@repo/backend/convex/contentRelease/ingress/current";
import { readRollback } from "@repo/backend/convex/contentRelease/ingress/rollback";
import type {
  cleanupReceiptValidator,
  headPageValidator,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

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
type HeadPage = Infer<typeof headPageValidator>;
type Status = Infer<typeof statusValidator>;
type CleanupReceipt = Infer<typeof cleanupReceiptValidator>;

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
      const value = yield* readRollback(ctx, request);
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

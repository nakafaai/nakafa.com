"use node";

import { MutationRunner, QueryRunner } from "@confect/server";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import refs from "@repo/backend/confect/_generated/refs";
import {
  loadVerifiedRelease,
  matchManifest,
  readCurrentPublication,
  readRecovery,
} from "@repo/backend/confect/contentRelease/ingress/current";
import { readRollback } from "@repo/backend/confect/contentRelease/ingress/rollback";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
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
/** Executes one authenticated bounded publication read or cleanup request. */
export const readPublication = Effect.fn("contentRelease.readPublication")(
  function* (ctx: ReadContext, request: ReadRequest) {
    const runQuery = yield* QueryRunner.QueryRunner.pipe(
      Effect.provide(QueryRunner.layer(ctx.runQuery))
    );
    const runMutation = yield* MutationRunner.MutationRunner.pipe(
      Effect.provide(MutationRunner.layer(ctx.runMutation))
    );
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
      const value = yield* runQuery(refs.internal.contentRelease.heads.page, {
        activeManifestHash: request.activeManifestHash,
        activeReleaseId: request.activeReleaseId,
        cursor: request.cursor,
        family: request.family,
        limit: request.limit,
      }).pipe(Effect.catchTag("SchemaError", Effect.die));
      return {
        ok: true,
        operation: request.operation,
        value,
      };
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
      const value = yield* runQuery(
        refs.internal.contentRelease.status.getStatus,
        {
          manifestHash: request.manifestHash,
          releaseId: request.releaseId,
        }
      ).pipe(Effect.catchTag("SchemaError", Effect.die));
      if (value.phase !== "missing") {
        const bundle = yield* loadVerifiedRelease(ctx, request.releaseId);
        yield* matchManifest(
          bundle.release,
          request.manifestHash,
          request.releaseId
        );
      }
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    if (
      request.operation === "rollbackPage" ||
      request.operation === "routePage"
    ) {
      const value = yield* readRollback(ctx, request);
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    const value = yield* runMutation(
      refs.internal.contentRelease.cleanup.cleanup,
      {
        releaseId: request.releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    return {
      ok: true,
      operation: request.operation,
      value,
    };
  }
);

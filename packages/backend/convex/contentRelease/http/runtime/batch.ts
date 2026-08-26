import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import {
  PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
} from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type {
  PredecessorRecordArgs,
  PredecessorRecordResult,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import {
  dispatchBatchProgram,
  dispatchPredecessorBatchProgram,
} from "@repo/backend/convex/contentRelease/runtime/public/batch";
import { failureResult } from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Result } from "effect";

const recordBatchReference = makeFunctionReference<
  "mutation",
  PredecessorRecordArgs,
  PredecessorRecordResult
>("contentRelease/predecessor/internal:recordBatch");

/** Authenticates and forwards one bounded public batch contract. */
const readPublicRuntimeBatch = Effect.fn(
  "contentRelease.readPublicRuntimeBatch"
)(function* (ctx: ActionCtx, request: Request) {
  const input = yield* readRuntimeRequest(
    request,
    env.CONTENT_RUNTIME_TOKEN,
    MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES
  );
  if (input.kind === "rejected") {
    return input.result;
  }
  return yield* dispatchBatchProgram(
    ctx,
    input.body.source,
    input.body.byteLength
  );
});

/** Records an authenticated predecessor batch before its runtime dispatch. */
const readPredecessorRuntimeBatch = Effect.fn(
  "contentRelease.readPredecessorRuntimeBatch"
)(function* (ctx: ActionCtx, request: Request) {
  const input = yield* readRuntimeRequest(
    request,
    env.CONTENT_RUNTIME_TOKEN,
    MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES
  );
  if (input.kind === "rejected") {
    return input.result;
  }
  const observed = yield* callInternal(() =>
    ctx.runMutation(recordBatchReference, {})
  ).pipe(Effect.result);
  if (Result.isFailure(observed)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  return yield* dispatchPredecessorBatchProgram(
    ctx,
    input.body.source,
    input.body.byteLength
  );
});

/** Registers the server-authenticated active public batch read route. */
export function registerPublicContentRuntimeBatchRoute<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.post(PUBLIC_CONTENT_RUNTIME_BATCH_PATH, async (context) => {
    const result = await runConvexProgram(
      readPublicRuntimeBatch(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
  app.post(PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH, async (context) => {
    const result = await runConvexProgram(
      readPredecessorRuntimeBatch(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
}

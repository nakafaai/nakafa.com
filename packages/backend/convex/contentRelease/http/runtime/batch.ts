import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import {
  PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
} from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import {
  dispatchBatchProgram,
  dispatchPredecessorBatchProgram,
} from "@repo/backend/convex/contentRelease/runtime/public/batch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect } from "effect";

/** Authenticates and forwards one bounded public batch contract. */
const readPublicRuntimeBatch = Effect.fn(
  "contentRelease.readPublicRuntimeBatch"
)(function* (
  ctx: ActionCtx,
  request: Request,
  dispatch: typeof dispatchBatchProgram
) {
  const input = yield* readRuntimeRequest(
    request,
    env.CONTENT_RUNTIME_TOKEN,
    MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES
  );
  if (input.kind === "rejected") {
    return input.result;
  }
  return yield* dispatch(ctx, input.body.source, input.body.byteLength);
});

/** Registers the server-authenticated active public batch read route. */
export function registerPublicContentRuntimeBatchRoute(
  app: HonoWithConvex<ActionCtx>
) {
  app.post(PUBLIC_CONTENT_RUNTIME_BATCH_PATH, async (context) => {
    const result = await runConvexProgram(
      readPublicRuntimeBatch(context.env, context.req.raw, dispatchBatchProgram)
    );
    return privateRuntimeResponse(result);
  });
  app.post(PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH, async (context) => {
    const result = await runConvexProgram(
      readPublicRuntimeBatch(
        context.env,
        context.req.raw,
        dispatchPredecessorBatchProgram
      )
    );
    return privateRuntimeResponse(result);
  });
}

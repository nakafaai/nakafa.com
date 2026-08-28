import { MAX_PUBLIC_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import {
  PUBLIC_CONTENT_RUNTIME_PATH,
  TRANSITION_PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type {
  PredecessorRecordArgs,
  PredecessorRecordResult,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/public/dispatch";
import { failureResult } from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Result } from "effect";

const recordSingularReference = makeFunctionReference<
  "mutation",
  PredecessorRecordArgs,
  PredecessorRecordResult
>("contentRelease/predecessor/internal:recordSingular");

/** Authenticates and forwards one bounded public runtime request. */
const publicRuntimeRoute = Effect.fn("contentRelease.publicRuntimeRoute")(
  function* (ctx: ActionCtx, request: Request) {
    const input = yield* readRuntimeRequest(
      request,
      env.CONTENT_RUNTIME_TOKEN,
      MAX_PUBLIC_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    return yield* dispatchProgram(
      ctx,
      input.body.source,
      input.body.byteLength
    );
  }
);

/** Records one authenticated transition request before current dispatch. */
const transitionRuntimeRoute = Effect.fn(
  "contentRelease.transitionRuntimeRoute"
)(function* (ctx: ActionCtx, request: Request) {
  const input = yield* readRuntimeRequest(
    request,
    env.CONTENT_RUNTIME_TOKEN,
    MAX_PUBLIC_RUNTIME_REQUEST_BYTES
  );
  if (input.kind === "rejected") {
    return input.result;
  }
  const observed = yield* callInternal(() =>
    ctx.runMutation(recordSingularReference, {})
  ).pipe(Effect.result);
  if (Result.isFailure(observed)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  return yield* dispatchProgram(ctx, input.body.source, input.body.byteLength);
});

/** Registers the server-authenticated active public content read route. */
export function registerPublicContentRuntimeRoute<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.post(PUBLIC_CONTENT_RUNTIME_PATH, async (context) => {
    const result = await runConvexProgram(
      publicRuntimeRoute(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
  app.post(TRANSITION_PUBLIC_CONTENT_RUNTIME_PATH, async (context) => {
    const result = await runConvexProgram(
      transitionRuntimeRoute(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
}

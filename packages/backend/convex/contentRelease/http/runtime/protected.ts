import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  PROTECTED_CONTENT_RUNTIME_PATH,
  PROTECTED_CONTENT_RUNTIME_V2_PATH,
} from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import {
  failureResult,
  type RuntimeHttpResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Result, Schema } from "effect";

const dispatchReference = makeFunctionReference<
  "action",
  { readonly byteLength: number; readonly source: string },
  RuntimeHttpResult
>("contentRelease/runtime/protected/dispatch:dispatch");

/** The isolated Node verifier could not return one sanitized response. */
class ProtectedRuntimeActionError extends Schema.TaggedError<ProtectedRuntimeActionError>()(
  "ProtectedRuntimeActionError",
  {}
) {}

/** Calls the Node-only verifier without exposing an action failure. */
const dispatchProtectedRuntime = Effect.fn(
  "contentRelease.dispatchProtectedRuntime"
)(function* (
  ctx: ActionCtx,
  input: { readonly byteLength: number; readonly source: string }
) {
  const result = yield* Effect.tryPromise({
    catch: () => new ProtectedRuntimeActionError(),
    try: () => ctx.runAction(dispatchReference, input),
  }).pipe(Effect.result);
  return Result.isFailure(result)
    ? failureResult("CONTENT_RUNTIME_INTERNAL", 500)
    : result.success;
});

/** Authenticates and forwards one bounded protected runtime request. */
const protectedRuntimeRoute = Effect.fn("contentRelease.protectedRuntimeRoute")(
  function* (ctx: ActionCtx, request: Request) {
    const input = yield* readRuntimeRequest(
      request,
      env.CONTENT_RUNTIME_TOKEN,
      MAX_PROTECTED_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    return yield* dispatchProtectedRuntime(ctx, input.body);
  }
);

/** Registers the server-authenticated retained protected content read route. */
export function registerProtectedContentRuntimeRoute<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  for (const path of [
    PROTECTED_CONTENT_RUNTIME_PATH,
    PROTECTED_CONTENT_RUNTIME_V2_PATH,
  ]) {
    app.post(path, async (context) => {
      const result = await runConvexProgram(
        protectedRuntimeRoute(context.env, context.req.raw)
      );
      return privateRuntimeResponse(result);
    });
  }
}

import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
  RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type {
  PredecessorRecordArgs,
  PredecessorRecordResult,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/history/dispatch";
import { failureResult } from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Result } from "effect";

const recordHistoryReference = makeFunctionReference<
  "mutation",
  PredecessorRecordArgs,
  PredecessorRecordResult
>("contentRelease/predecessor/internal:recordHistory");

/** Authenticates and forwards one bounded attempt-owned history request. */
const retainedRuntimeRoute = Effect.fn("contentRelease.retainedRuntimeRoute")(
  function* (
    ctx: ActionCtx,
    request: Request,
    contract: "current" | "predecessor"
  ) {
    const input = yield* readRuntimeRequest(
      request,
      env.CONTENT_RUNTIME_TOKEN,
      MAX_PROTECTED_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    if (contract === "predecessor") {
      const observed = yield* callInternal(() =>
        ctx.runMutation(recordHistoryReference, {})
      ).pipe(Effect.result);
      if (Result.isFailure(observed)) {
        return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
      }
    }
    return yield* dispatchProgram(
      ctx,
      input.body.source,
      input.body.byteLength
    );
  }
);

/** Registers the isolated read-only endpoint for retained attempt bytes. */
export function registerRetainedProtectedContentRuntimeRoute<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.post(
    PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
    async (context) => {
      const result = await runConvexProgram(
        retainedRuntimeRoute(context.env, context.req.raw, "predecessor")
      );
      return privateRuntimeResponse(result);
    }
  );
  app.post(RETAINED_PROTECTED_CONTENT_RUNTIME_PATH, async (context) => {
    const result = await runConvexProgram(
      retainedRuntimeRoute(context.env, context.req.raw, "current")
    );
    return privateRuntimeResponse(result);
  });
}

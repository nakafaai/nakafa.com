import { MAX_PUBLIC_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { readRuntimeRequest } from "@repo/backend/confect/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/confect/contentRelease/http/runtime/response";
import { dispatchProgram } from "@repo/backend/confect/contentRelease/runtime/publication/dispatch";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { PUBLIC_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect } from "effect";

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
}

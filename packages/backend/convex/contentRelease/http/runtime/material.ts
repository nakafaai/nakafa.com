import { MAX_PUBLIC_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { MATERIAL_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import { dispatchMaterialProgram } from "@repo/backend/convex/contentRelease/runtime/public/material";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect } from "effect";

/** Authenticates and forwards one cohesive material runtime request. */
const readMaterialRuntime = Effect.fn("contentRelease.readMaterialRuntime")(
  function* (ctx: ActionCtx, request: Request) {
    const input = yield* readRuntimeRequest(
      request,
      env.CONTENT_RUNTIME_TOKEN,
      MAX_PUBLIC_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    return yield* dispatchMaterialProgram(
      ctx,
      input.body.source,
      input.body.byteLength
    );
  }
);

/** Registers the server-authenticated cohesive material read route. */
export function registerMaterialContentRuntimeRoute<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.post(MATERIAL_CONTENT_RUNTIME_PATH, async (context) => {
    const result = await runConvexProgram(
      readMaterialRuntime(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
}

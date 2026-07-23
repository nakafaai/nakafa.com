import { MAX_PUBLICATION_REQUEST_BYTES } from "@nakafa/aksara-contracts/transport/limits";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import {
  type HttpBodyError,
  readJsonBody,
} from "@repo/backend/convex/contentRelease/http/body";
import {
  bearerToken,
  matchesHttpSecret,
} from "@repo/backend/convex/contentRelease/http/secret";
import { predecodeFailure } from "@repo/backend/convex/contentRelease/ingress/failure";
import { publicationFailure } from "@repo/backend/convex/contentRelease/ingress/response";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { getConvexSize } from "convex/values";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Either } from "effect";

const NODE_ACTION_ARGUMENT_BYTES = 5 * 1024 * 1024;

const publicationDispatchReference = makeFunctionReference<
  "action",
  { byteLength: number; source: string },
  { body: string; status: number }
>("contentRelease/ingress/dispatch:dispatch");

/** Converts an oversized Node argument envelope into a sanitized response. */
function rejectOversizedDispatch() {
  return publicationFailure(
    predecodeFailure(
      new ReleaseError({
        code: "CONTENT_RELEASE_SIZE",
        message: "Publication request was rejected before dispatch.",
      })
    )
  );
}

/** Converts one shared HTTP body rejection into publication wire semantics. */
function publicationBodyError(error: HttpBodyError) {
  if (error.reason === "size") {
    return new ReleaseError({
      code: "CONTENT_RELEASE_SIZE",
      message: "Content publication request body was rejected.",
    });
  }
  if (error.reason === "unsupported") {
    return new ReleaseError({
      code: "CONTENT_RELEASE_UNSUPPORTED",
      message: "Content publication request body was rejected.",
    });
  }
  return new ReleaseError({
    code: "CONTENT_RELEASE_INVALID_REQUEST",
    message: "Content publication request body was rejected.",
  });
}

/** Returns the single sanitized publication authentication rejection. */
function publicationAuthFailure() {
  return publicationFailure(
    predecodeFailure(
      new ReleaseError({
        code: "CONTENT_RELEASE_UNAUTHORIZED",
        message: "Content publication authentication failed.",
      })
    )
  );
}

/** Reads one bounded request and invokes the isolated Node verifier. */
const publicationRoute = Effect.fn("contentRelease.publicationRoute")(
  function* (ctx: ActionCtx, request: Request) {
    const authenticated = yield* matchesHttpSecret(
      bearerToken(request.headers.get("authorization") ?? ""),
      env.AKSARA_PUBLICATION_TOKEN
    ).pipe(Effect.either);
    if (Either.isLeft(authenticated) || !authenticated.right) {
      return yield* publicationAuthFailure();
    }
    const body = yield* readJsonBody(
      request,
      MAX_PUBLICATION_REQUEST_BYTES
    ).pipe(Effect.either);
    if (Either.isLeft(body)) {
      return yield* publicationFailure(
        predecodeFailure(publicationBodyError(body.left))
      );
    }
    if (getConvexSize(body.right) > NODE_ACTION_ARGUMENT_BYTES) {
      return yield* rejectOversizedDispatch();
    }
    return yield* Effect.promise(() =>
      ctx.runAction(publicationDispatchReference, body.right)
    );
  }
);

/** Registers the single private content-publication ingress. */
export function registerContentReleaseRoutes(app: HonoWithConvex<ActionCtx>) {
  app.post("/internal/content/releases", async (context) => {
    const result = await runConvexProgram(
      publicationRoute(context.env, context.req.raw)
    );
    return new Response(result.body, {
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
      status: result.status,
    });
  });
}

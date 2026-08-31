"use node";
import {
  loadVerifiedRelease,
  matchManifest,
} from "@repo/backend/convex/contentRelease/ingress/current";
import { readBodyPage } from "@repo/backend/convex/contentRelease/ingress/rollback/body";
import type {
  ReadContext,
  RollbackRequest,
} from "@repo/backend/convex/contentRelease/ingress/rollback/request";
import { readRoutePage } from "@repo/backend/convex/contentRelease/ingress/rollback/route";
import { Effect } from "effect";

/** Reads one authenticated body or route rollback page. */
export const readRollback = Effect.fn("contentRelease.readRollback")(function* (
  ctx: ReadContext,
  request: RollbackRequest
) {
  const bundle = yield* loadVerifiedRelease(ctx, request.rollbackOf);
  yield* matchManifest(
    bundle.release,
    request.rollbackOfManifestHash,
    request.rollbackOf
  );
  if (request.operation === "rollbackPage") {
    return yield* readBodyPage(ctx, request, bundle.release.manifest.itemCount);
  }
  return yield* readRoutePage(ctx, request, bundle.release.manifest.routeCount);
});

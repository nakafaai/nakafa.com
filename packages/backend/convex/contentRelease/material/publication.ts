import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolveMaterialModel } from "@repo/backend/convex/contentRelease/material/model";
import { readPublicRuntime } from "@repo/backend/convex/contentRelease/runtime/public/internal";
import { Effect } from "effect";

/** Reads one complete material shell and body from one active route proof. */
export const readMaterialPublication = Effect.fn(
  "contentRelease.readMaterialPublication"
)(function* (
  ctx: QueryCtx,
  appLocale: Doc<"materialCatalog">["appLocale"],
  publicPath: string
) {
  const { model, route } = yield* resolveMaterialModel(
    ctx,
    appLocale,
    publicPath
  );
  if (!route.material) {
    return { model, runtime: null };
  }
  const runtime = yield* readPublicRuntime(
    ctx,
    route.active,
    route.head,
    appLocale,
    publicPath
  );
  return { model, runtime };
});

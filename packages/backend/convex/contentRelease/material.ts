import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import {
  localeValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const routeResultValidator = v.union(
  v.object({ kind: v.literal("unmanaged") }),
  v.object({ kind: v.literal("missing") }),
  v.object({
    activeReleaseId: v.string(),
    kind: v.literal("found"),
    projectionJson: v.string(),
    rendererDomain: rendererDomainValidator,
  })
);

type ContentLocale = Infer<typeof localeValidator>;

/** Reads the permanent ownership entry for one localized public path. */
const loadPath = Effect.fn("contentRelease.loadMaterialPath")(function* (
  ctx: QueryCtx,
  locale: ContentLocale,
  publicPath: string
) {
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("contentPaths")
      .withIndex("by_locale_and_publicPath", (index) =>
        index.eq("locale", locale).eq("publicPath", publicPath)
      )
      .take(2)
  );
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material route ${locale}/${publicPath} has duplicate ownership.`
    );
  }

  return rows[0] ?? null;
});

/** Resolves one material route from the exact active publication sequence. */
const resolveMaterialRoute = Effect.fn("contentRelease.resolveMaterialRoute")(
  function* (ctx: QueryCtx, locale: ContentLocale, publicPath: string) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return { kind: "unmanaged" } as const;
    }
    const path = yield* loadPath(ctx, locale, publicPath);
    if (!path || path.createdSequence > active.sequence) {
      return { kind: "unmanaged" } as const;
    }
    const binding = yield* loadRouteBinding(
      ctx,
      locale,
      publicPath,
      active.sequence
    );
    if (!binding || binding.operation === "delete") {
      return { kind: "missing" } as const;
    }
    if (!binding.contentKey) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material route ${locale}/${publicPath} lost its content identity.`
      );
    }
    const head = yield* loadVersion(
      ctx,
      binding.contentKey,
      locale,
      active.sequence
    );
    if (
      head?.operation !== "upsert" ||
      head.family !== "material" ||
      head.delivery !== "public" ||
      !head.projectionHash ||
      !head.projectionJson ||
      !head.rendererDomain ||
      !head.sourcePath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material route ${locale}/${publicPath} lost its public projection.`
      );
    }
    if (
      head.sequence === binding.sequence &&
      head.releaseId !== binding.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material route ${locale}/${publicPath} disagrees at one sequence.`
      );
    }
    const projection = yield* decodeProjectionJson(head.projectionJson);
    const projectionHash = yield* hashText(
      "the active material projection",
      canonicalizeMaterialProjection(projection)
    );
    if (
      projectionHash !== head.projectionHash ||
      projection.contentKey !== head.contentKey ||
      projection.locale !== locale ||
      projection.publicPath !== publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material route ${locale}/${publicPath} has mismatched projection data.`
      );
    }

    return {
      activeReleaseId: active.releaseId,
      kind: "found",
      projectionJson: head.projectionJson,
      rendererDomain: head.rendererDomain,
    } as const;
  }
);

/** Returns public material route ownership without exposing artifact code. */
export const resolve = query({
  args: { locale: localeValidator, publicPath: v.string() },
  returns: routeResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(resolveMaterialRoute(ctx, args.locale, args.publicPath)),
});

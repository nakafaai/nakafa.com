import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import { materialSegments } from "@repo/internationalization/src/segments";
import { Effect, Either, Option, Schema } from "effect";
import {
  MaterialRouteError,
  resolveMaterial,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import {
  type MaterialRouteParams,
  type MaterialRouteTarget,
  matchesMaterialRouteTarget,
  type ResolvedMaterialRoute,
} from "@/lib/content/material";
import { readActiveMaterialRoute } from "@/lib/content/published/route";

/** One resolved route with its exclusive body owner. */
export interface OwnedMaterialRoute extends ResolvedMaterialRoute {
  readonly owner: "published" | "source";
}

/** Builds one localized public path directly from Next route params. */
const buildPublicPath = Effect.fn("NakafaContent.buildMaterialPublicPath")(
  function* (params: MaterialRouteParams, target: MaterialRouteTarget) {
    const locale = yield* Schema.decodeUnknown(ContentLocaleSchema)(
      params.locale
    ).pipe(
      Effect.mapError(
        () =>
          new MaterialRouteError({
            reason: "locale",
            value: params.locale,
          })
      )
    );
    const segments = materialSegments[locale];
    const subject = target === "generic" ? params.subject : segments[target];
    if (!subject) {
      return Option.none<{
        readonly locale: typeof locale;
        readonly publicPath: string;
      }>();
    }

    return Option.some({
      locale,
      publicPath: [
        segments.namespace,
        subject,
        params.topic,
        ...(params.lesson ?? []),
      ].join("/"),
    });
  }
);

/**
 * Resolves active Aksara ownership before consulting unmigrated source routes.
 *
 * A permanently owned missing route never reaches the source catalog, so
 * deletions and renames cannot revive an obsolete MDX body.
 */
export const readMaterialRequestRoute = Effect.fn(
  "NakafaContent.readMaterialRequestRoute"
)(function* (params: MaterialRouteParams, target: MaterialRouteTarget) {
  const path = yield* buildPublicPath(params, target);
  if (Option.isNone(path)) {
    return Option.none<OwnedMaterialRoute>();
  }
  const active = yield* readActiveMaterialRoute(path.value);
  if (active.kind === "missing") {
    return Option.none<OwnedMaterialRoute>();
  }
  if (active.kind === "found") {
    if (!matchesMaterialRouteTarget(active.rendererDomain, target)) {
      return yield* new MaterialRouteError({
        reason: "renderer-domain",
        value: path.value.publicPath,
      });
    }

    return Option.some({
      locale: path.value.locale,
      owner: "published",
      rendererDomain: active.rendererDomain,
      route: active.route,
    } satisfies OwnedMaterialRoute);
  }
  const source = yield* Either.match(resolveMaterial(params, target), {
    onLeft: Effect.fail,
    onRight: Effect.succeed,
  });
  if (Option.isNone(source)) {
    return Option.none<OwnedMaterialRoute>();
  }

  return Option.some({
    ...source.value,
    owner: "source",
  } satisfies OwnedMaterialRoute);
});

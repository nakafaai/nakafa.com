import "server-only";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import { previewDocumentRoute } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { readNamespaceSegment } from "@repo/contents/_types/route/path";
import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";

/** Exact public route identity checked before Convex route rejection. */
interface PreviewRouteInput {
  readonly locale: ContentLocale;
  readonly publicPath: string;
}

/** Next-intl rewrite identity visible only on its internal second pass. */
interface InternalRouteInput {
  readonly localeHint: string | null;
  readonly pathname: string;
}

/** Material page identity checked before consulting the static route catalog. */
export interface MaterialPreviewRouteInput {
  readonly params: {
    readonly lesson?: readonly string[];
    readonly locale: string;
    readonly subject: string;
    readonly topic: string;
  };
}

/** Checks whether two route segment collections are byte-for-byte equal. */
function hasSameSegments(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

/** Checks whether one manifest document owns the requested physical route. */
export function matchesMaterialPreviewRoute(
  manifest: LocalPreviewManifest,
  input: MaterialPreviewRouteInput
) {
  if (manifest.document.family !== "material") {
    return false;
  }

  const { route } = manifest.document;
  if (route.locale !== input.params.locale) {
    return false;
  }

  const [namespace, subject, topic, ...lesson] = route.publicPath.split("/");
  if (
    namespace !== readNamespaceSegment("subject", route.locale) ||
    subject !== input.params.subject ||
    topic !== input.params.topic ||
    !hasSameSegments(lesson, input.params.lesson ?? [])
  ) {
    return false;
  }

  return true;
}

/** Derives one exact Nakafa read-model route from a ready preview projection. */
export function decodeMaterialPreviewRoute(
  projection: MaterialLessonProjection
) {
  const { metadata, ...routeProjection } = projection;

  return Schema.decodeUnknown(PublicContentRouteSchema)({
    description: metadata.description,
    kind: routeProjection.kind,
    locale: routeProjection.locale,
    materialKey: routeProjection.materialKey,
    order: routeProjection.order,
    parentPath: routeProjection.parentPath,
    publicPath: routeProjection.publicPath,
    sectionKey: routeProjection.sectionKey,
    sitemap: routeProjection.sitemap,
    sourcePath: routeProjection.contentKey,
    title: metadata.title,
  }).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "projection" }))
  );
}

/** Resolves a next-intl material rewrite back to its canonical public path. */
function resolveInternalRoute({ localeHint, pathname }: InternalRouteInput) {
  const [locale, appSegment, ...segments] = pathname.split("/").filter(Boolean);
  if (!(hasLocale(routing.locales, locale) && localeHint === locale)) {
    return Option.none<PreviewRouteInput>();
  }

  const surface = PUBLIC_ROUTE_SURFACES.find(
    (candidate) => candidate.key === "subject"
  );
  if (!(surface && appSegment === surface.appSegment && segments.length >= 3)) {
    return Option.none<PreviewRouteInput>();
  }

  return Option.some({
    locale,
    publicPath: [surface.routeSlugs[locale], ...segments].join("/"),
  });
}

/** Reports whether the selected changed document owns one exact public route. */
export const matchesPreviewRoute = Effect.fn(
  "NakafaContent.matchesPreviewRoute"
)(function* (input: PreviewRouteInput) {
  const snapshot = yield* readPreviewSnapshot();

  return Option.match(snapshot, {
    onNone: () => false,
    onSome: ({ manifest }) => {
      const route = previewDocumentRoute(manifest.document);
      return (
        route.locale === input.locale && route.publicPath === input.publicPath
      );
    },
  });
});

/** Allows only the selected local document through next-intl's internal pass. */
export const matchesInternalPreviewRoute = Effect.fn(
  "NakafaContent.matchesInternalPreviewRoute"
)(function* (input: InternalRouteInput) {
  const route = resolveInternalRoute(input);
  if (Option.isNone(route)) {
    return false;
  }

  return yield* matchesPreviewRoute(route.value);
});

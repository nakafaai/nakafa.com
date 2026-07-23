import "server-only";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { readNamespaceSegment } from "@repo/contents/_types/route/path";
import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import type {
  MaterialRouteParams,
  MaterialRouteTarget,
} from "@/lib/content/material";
import { matchesMaterialRouteTarget } from "@/lib/content/material";
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
  readonly params: MaterialRouteParams;
  readonly target: MaterialRouteTarget;
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
  const { rendererDomain, route } = manifest.document;
  if (route.locale !== input.params.locale) {
    return false;
  }

  const [namespace, subject, topic, ...lesson] = route.publicPath.split("/");
  const expectedSubject = MATERIAL_ROUTE_DOMAINS.find(
    (candidate) => candidate.domain === rendererDomain
  )?.routeSlugs[route.locale];
  if (
    namespace !== readNamespaceSegment("subject", route.locale) ||
    subject !== expectedSubject ||
    topic !== input.params.topic ||
    !hasSameSegments(lesson, input.params.lesson ?? [])
  ) {
    return false;
  }

  if (subject !== input.params.subject && input.target === "generic") {
    return false;
  }

  return matchesMaterialRouteTarget(rendererDomain, input.target);
}

/** Derives one exact Nakafa read-model route from a ready preview projection. */
export function decodeMaterialPreviewRoute(
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>
) {
  const { metadata, ...projection } = manifest.projection;

  return Schema.decodeUnknown(PublicContentRouteSchema)({
    description: metadata.description,
    kind: projection.kind,
    locale: projection.locale,
    materialKey: projection.materialKey,
    order: projection.order,
    parentPath: projection.parentPath,
    publicPath: projection.publicPath,
    sectionKey: projection.sectionKey,
    sitemap: projection.sitemap,
    sourcePath: projection.contentKey,
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
    onSome: ({ manifest }) =>
      manifest.document.route.locale === input.locale &&
      manifest.document.route.publicPath === input.publicPath,
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

import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { previewDocumentRoute } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import { materialPublicNamespace } from "@nakafa/aksara-contracts/projection/material";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** Exact public route identity checked before Convex route rejection. */
const PreviewRouteInputSchema = Schema.Struct({
  appLocale: AppLocaleSchema,
  publicPath: Schema.String,
});
type PreviewRouteInput = typeof PreviewRouteInputSchema.Type;
/** Locale rewrite identity visible only on the router's internal second pass. */
const InternalRouteInputSchema = Schema.Struct({
  localeHint: Schema.NullOr(Schema.String),
  pathname: Schema.String,
});
type InternalRouteInput = typeof InternalRouteInputSchema.Type;
/** Material page identity checked before consulting the static route catalog. */
const MaterialPreviewRouteInputSchema = Schema.Struct({
  params: Schema.Struct({
    lesson: Schema.optionalKey(Schema.Array(Schema.String)),
    locale: Schema.String,
    subject: Schema.String,
    topic: Schema.String,
  }),
});
export type MaterialPreviewRouteInput =
  typeof MaterialPreviewRouteInputSchema.Type;
/** Checks whether two route segment collections are byte-for-byte equal. */
function hasSameSegments(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    Arr.every(left, (segment, index) => segment === right[index])
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
  if (route.appLocale !== input.params.locale) {
    return false;
  }
  const [namespace, subject, topic, ...lesson] = route.publicPath.split("/");
  if (
    namespace !== materialPublicNamespace(route.appLocale) ||
    subject !== input.params.subject ||
    topic !== input.params.topic ||
    !hasSameSegments(lesson, input.params.lesson ?? [])
  ) {
    return false;
  }
  return true;
}
/** Resolves a the locale seam material rewrite back to its canonical public path. */
function resolveInternalRoute({ localeHint, pathname }: InternalRouteInput) {
  const [locale, appSegment, ...segments] = Arr.filter(
    pathname.split("/"),
    Boolean
  );
  if (!(Schema.is(LocaleSchema)(locale) && localeHint === locale)) {
    return Option.none<PreviewRouteInput>();
  }
  const surface = Arr.findFirst(
    PUBLIC_ROUTE_SURFACES,
    (candidate) => candidate.key === "subject"
  );
  if (
    Option.isNone(surface) ||
    !(appSegment === surface.value.appSegment && segments.length >= 3)
  ) {
    return Option.none<PreviewRouteInput>();
  }
  return Option.some({
    appLocale: AppLocaleSchema.make(locale),
    publicPath: Arr.join([surface.value.routeSlugs[locale], ...segments], "/"),
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
        route.appLocale === input.appLocale &&
        route.publicPath === input.publicPath
      );
    },
  });
});
/** Reports whether the manifest owns one exact localized public pathname. */
export const matchesPreviewPathname = Effect.fn(
  "NakafaContent.matchesPreviewPathname"
)(function* (pathname: string) {
  const [locale, ...segments] = Arr.filter(pathname.split("/"), Boolean);
  if (!(Schema.is(LocaleSchema)(locale) && segments.length > 0)) {
    return false;
  }
  return yield* matchesPreviewRoute({
    appLocale: AppLocaleSchema.make(locale),
    publicPath: Arr.join(segments, "/"),
  });
});
/** Allows only the selected local document through the locale seam's internal pass. */
export const matchesInternalPreviewRoute = Effect.fn(
  "NakafaContent.matchesInternalPreviewRoute"
)(function* (input: InternalRouteInput) {
  const route = resolveInternalRoute(input);
  if (Option.isNone(route)) {
    return false;
  }
  return yield* matchesPreviewRoute(route.value);
});

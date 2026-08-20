import "server-only";

import {
  APP_LOCALE_CODES,
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { previewDocumentRoute } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { materialPublicNamespace } from "@nakafa/aksara-contracts/projection/material";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Effect, Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";

/** Exact public route identity checked before Convex route rejection. */
interface PreviewRouteInput {
  readonly appLocale: AppLocale;
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

/** Runtime contract for one concrete material preview route. */
const MaterialPreviewStaticParamsSchema = Schema.Struct({
  lesson: Schema.NonEmptyArray(Schema.NonEmptyTrimmedString),
  subject: Schema.NonEmptyTrimmedString,
  topic: Schema.NonEmptyTrimmedString,
});

/** Concrete child params Next prerenders for one selected material preview. */
export type MaterialPreviewStaticParams =
  typeof MaterialPreviewStaticParamsSchema.Type;

/** Runtime contract for one concrete article preview route. */
const ArticlePreviewStaticParamsSchema = Schema.Struct({
  category: ArticleRouteSlugSchema,
  slug: ArticleRouteSlugSchema,
});

/** Concrete child params Next prerenders for one selected article preview. */
export type ArticlePreviewStaticParams =
  typeof ArticlePreviewStaticParamsSchema.Type;

/** Reads the single selected locale used to prerender the preview app shell. */
export const readPreviewStaticLocaleParams = Effect.fn(
  "NakafaContent.readPreviewStaticLocaleParams"
)(function* () {
  const snapshot = yield* readPreviewSnapshot();
  if (Option.isNone(snapshot)) {
    return yield* new PreviewIntegrityError({ check: "manifest" });
  }

  const route = previewDocumentRoute(snapshot.value.manifest.document);
  return [{ locale: route.appLocale }];
});

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

/** Parses one canonical material path into Next child params. */
export const parseMaterialPreviewStaticParams = Effect.fn(
  "NakafaContent.parseMaterialPreviewStaticParams"
)(function* ({
  appLocale,
  publicPath,
}: {
  readonly appLocale: AppLocale;
  readonly publicPath: string;
}) {
  const [namespace, subject, topic, ...lesson] = publicPath.split("/");
  if (namespace !== materialPublicNamespace(appLocale)) {
    return yield* new PreviewIntegrityError({ check: "projection" });
  }

  return yield* Schema.decodeUnknown(MaterialPreviewStaticParamsSchema)({
    lesson,
    subject,
    topic,
  }).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "projection" }))
  );
});

/** Reads the selected material route so Cache Components can build its shell. */
export const readMaterialPreviewStaticParams = Effect.fn(
  "NakafaContent.readMaterialPreviewStaticParams"
)(function* (appLocale: AppLocale) {
  const snapshot = yield* readPreviewSnapshot();
  if (Option.isNone(snapshot)) {
    return yield* new PreviewIntegrityError({ check: "manifest" });
  }

  const document = snapshot.value.manifest.document;
  if (
    document.family !== "material" ||
    document.route.appLocale !== appLocale
  ) {
    return yield* new PreviewIntegrityError({ check: "projection" });
  }

  return yield* parseMaterialPreviewStaticParams({
    appLocale,
    publicPath: document.route.publicPath,
  });
});

/** Reads the selected article route so Cache Components can build its shell. */
export const readArticlePreviewStaticParams = Effect.fn(
  "NakafaContent.readArticlePreviewStaticParams"
)(function* (appLocale: AppLocale) {
  const snapshot = yield* readPreviewSnapshot();
  if (Option.isNone(snapshot)) {
    return yield* new PreviewIntegrityError({ check: "manifest" });
  }

  const document = snapshot.value.manifest.document;
  if (document.family !== "article" || document.route.appLocale !== appLocale) {
    return yield* new PreviewIntegrityError({ check: "projection" });
  }

  return ArticlePreviewStaticParamsSchema.make({
    category: document.route.categoryRouteSlug,
    slug: document.route.articleRouteSlug,
  });
});

/** Resolves a next-intl material rewrite back to its canonical public path. */
function resolveInternalRoute({ localeHint, pathname }: InternalRouteInput) {
  const [locale, appSegment, ...segments] = pathname.split("/").filter(Boolean);
  if (!(hasLocale(APP_LOCALE_CODES, locale) && localeHint === locale)) {
    return Option.none<PreviewRouteInput>();
  }

  const surface = PUBLIC_ROUTE_SURFACES.find(
    (candidate) => candidate.key === "subject"
  );
  if (!(surface && appSegment === surface.appSegment && segments.length >= 3)) {
    return Option.none<PreviewRouteInput>();
  }

  return Option.some({
    appLocale: AppLocaleSchema.make(locale),
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
  const [locale, ...segments] = pathname.split("/").filter(Boolean);
  if (!(hasLocale(APP_LOCALE_CODES, locale) && segments.length > 0)) {
    return false;
  }

  return yield* matchesPreviewRoute({
    appLocale: AppLocaleSchema.make(locale),
    publicPath: segments.join("/"),
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

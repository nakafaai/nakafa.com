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
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import { hasLocale } from "next-intl";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import {
  readPreviewManifestForPrerender,
  readPreviewSnapshot,
} from "@/lib/content/preview/manifest";

/** Exact public route identity checked before Convex route rejection. */
const PreviewRouteInputSchema = Schema.Struct({
  appLocale: AppLocaleSchema,
  publicPath: Schema.String,
});
type PreviewRouteInput = typeof PreviewRouteInputSchema.Type;
/** Next-intl rewrite identity visible only on its internal second pass. */
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
/** Runtime contract for one concrete material preview route. */
const MaterialPreviewStaticParamsSchema = Schema.Struct({
  lesson: Schema.NonEmptyArray(Schema.Trimmed.check(Schema.isNonEmpty())),
  subject: Schema.Trimmed.check(Schema.isNonEmpty()),
  topic: Schema.Trimmed.check(Schema.isNonEmpty()),
});
/** Runtime contract for one concrete article preview route. */
const ArticlePreviewStaticParamsSchema = Schema.Struct({
  category: ArticleRouteSlugSchema,
  slug: ArticleRouteSlugSchema,
});
/** Concrete child params Next prerenders for one selected Page preview. */
const PagePreviewStaticParamsSchema = Schema.Struct({
  page: Schema.Array(Schema.String),
});
type PagePreviewStaticParams = typeof PagePreviewStaticParamsSchema.Type;
/** Reads the single selected locale used to prerender the preview app shell. */
export function readPreviewStaticLocaleParams() {
  return readPreviewManifestForPrerender().then((manifest) => {
    const route = previewDocumentRoute(manifest.document);
    return [{ locale: route.appLocale }];
  });
}
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
/** Decodes one canonical material path without starting a runtime. */
function decodeMaterialPreviewStaticParams({
  appLocale,
  publicPath,
}: {
  readonly appLocale: AppLocale;
  readonly publicPath: string;
}) {
  const [namespace, subject, topic, ...lesson] = publicPath.split("/");
  if (namespace !== materialPublicNamespace(appLocale)) {
    return Result.fail(new PreviewIntegrityError({ check: "projection" }));
  }
  return Result.mapError(
    Schema.decodeUnknownResult(MaterialPreviewStaticParamsSchema)({
      lesson,
      subject,
      topic,
    }),
    () => new PreviewIntegrityError({ check: "projection" })
  );
}
/** Parses one canonical material path into Next child params. */
export const parseMaterialPreviewStaticParams = Effect.fn(
  "NakafaContent.parseMaterialPreviewStaticParams"
)(function* (input: {
  readonly appLocale: AppLocale;
  readonly publicPath: string;
}) {
  const decoded = decodeMaterialPreviewStaticParams(input);
  if (Result.isFailure(decoded)) {
    return yield* decoded.failure;
  }
  return decoded.success;
});
/** Reads the selected material route so Cache Components can build its shell. */
export function readMaterialPreviewStaticParams(appLocale: AppLocale) {
  return readPreviewManifestForPrerender().then((manifest) => {
    const document = manifest.document;
    if (document.family !== "material") {
      return [];
    }
    if (document.route.appLocale !== appLocale) {
      return Promise.reject(new PreviewIntegrityError({ check: "projection" }));
    }
    const decoded = decodeMaterialPreviewStaticParams({
      appLocale,
      publicPath: document.route.publicPath,
    });
    if (Result.isFailure(decoded)) {
      return Promise.reject(decoded.failure);
    }
    return [decoded.success];
  });
}
/** Reads the selected article route so Cache Components can build its shell. */
export function readArticlePreviewStaticParams(appLocale: AppLocale) {
  return readPreviewManifestForPrerender().then((manifest) => {
    const document = manifest.document;
    if (document.family !== "article") {
      return [];
    }
    if (document.route.appLocale !== appLocale) {
      return Promise.reject(new PreviewIntegrityError({ check: "projection" }));
    }
    return [
      ArticlePreviewStaticParamsSchema.make({
        category: document.route.categoryRouteSlug,
        slug: document.route.articleRouteSlug,
      }),
    ];
  });
}
/** Reads the selected Page route so Cache Components can build its shell. */
export function readPagePreviewStaticParams(appLocale: AppLocale) {
  return readPreviewManifestForPrerender().then((manifest) => {
    const document = manifest.document;
    if (document.family !== "page") {
      return [];
    }
    if (document.route.appLocale !== appLocale) {
      return Promise.reject(new PreviewIntegrityError({ check: "projection" }));
    }
    return [
      {
        page: document.route.publicPath.split("/"),
      } satisfies PagePreviewStaticParams,
    ];
  });
}
/** Resolves a next-intl material rewrite back to its canonical public path. */
function resolveInternalRoute({ localeHint, pathname }: InternalRouteInput) {
  const [locale, appSegment, ...segments] = Arr.filter(
    pathname.split("/"),
    Boolean
  );
  if (!(hasLocale(APP_LOCALE_CODES, locale) && localeHint === locale)) {
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
  if (!(hasLocale(APP_LOCALE_CODES, locale) && segments.length > 0)) {
    return false;
  }
  return yield* matchesPreviewRoute({
    appLocale: AppLocaleSchema.make(locale),
    publicPath: Arr.join(segments, "/"),
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

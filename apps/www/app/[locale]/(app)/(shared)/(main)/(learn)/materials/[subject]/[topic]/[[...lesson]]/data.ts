import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { readNamespaceSegment } from "@repo/contents/_types/route/surface";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { getPublishedMaterialRoutes } from "@/lib/content/material/catalog";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readMaterialPreviewStaticParams } from "@/lib/content/preview/route";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

export type MaterialParams =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">["params"];
export type MaterialRouteParams = Awaited<MaterialParams>;

/** Parses one localized OG slug into concrete material lesson params. */
export function parseMaterialParams(
  locale: Locale,
  slug: readonly string[]
): MaterialRouteParams | null {
  const namespace = readNamespaceSegment("subject", locale);
  if (!namespace || slug[0] !== namespace || slug.length < 4) {
    return null;
  }
  const [, subject, topic, ...lesson] = slug;
  if (!(subject && topic && lesson.length > 0)) {
    return null;
  }
  return { lesson, locale, subject, topic };
}

/** Builds the exact localized path without consulting content storage. */
export async function readMaterialRequest(params: MaterialParams) {
  const { locale: rawLocale, subject, topic, lesson } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const namespace = readNamespaceSegment("subject", locale);
  if (!namespace) {
    return { locale, publicPath: undefined };
  }

  return {
    locale,
    publicPath: [namespace, subject, topic, ...(lesson ?? [])].join("/"),
  };
}

/** Builds static params exclusively from the signed material catalog. */
export async function listMaterialStaticParams(rawLocale: string) {
  const locale = getLocaleOrThrow(rawLocale);
  if (hasPreviewConfig()) {
    const preview = await Effect.runPromise(
      readMaterialPreviewStaticParams(AppLocaleSchema.make(locale))
    );
    return [preview];
  }

  const published = await getPublishedMaterialRoutes(locale);
  const params = published.routes.map((route) => {
    const [, subject, topic, ...lesson] = route.publicPath.split("/");
    return { lesson, subject, topic };
  });
  return selectLearningStaticParams(params);
}

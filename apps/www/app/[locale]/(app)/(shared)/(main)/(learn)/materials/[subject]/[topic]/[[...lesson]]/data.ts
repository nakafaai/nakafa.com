import { readNamespaceSegment } from "@repo/contents/_types/route/surface";
import type { Locale } from "next-intl";
import { getLocaleOrThrow } from "@/lib/i18n/params";

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

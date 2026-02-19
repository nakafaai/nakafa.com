import { getContents } from "@repo/contents/_lib/content";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export const revalidate = false;

const baseUrl = "https://nakafa.com";

export async function GET() {
  const locales = routing.locales;

  const [t, tCommon] = await Promise.all([
    getTranslations({
      namespace: "Metadata",
      locale: routing.defaultLocale,
    }),
    getTranslations({
      namespace: "Common",
      locale: routing.defaultLocale,
    }),
  ]);

  // Fetch all articles and subjects for all locales in parallel
  const contentPromises = locales.flatMap((locale) => [
    Effect.runPromise(getContents({ locale, basePath: "articles" })).then(
      (contents) => ({
        locale,
        contents,
      })
    ),
    Effect.runPromise(getContents({ locale, basePath: "subject" })).then(
      (contents) => ({
        locale,
        contents,
      })
    ),
  ]);

  const results = await Promise.all(contentPromises);

  const feed = new Feed({
    title: t("title"),
    description: t("description"),
    id: `${baseUrl}`,
    link: `${baseUrl}`,
    language: routing.defaultLocale,
    image: `${baseUrl}/og.png`,
    favicon: `${baseUrl}/icon.png`,
    copyright: tCommon("copyright", { year: new Date().getFullYear() }),
  });

  // Collect all feed items
  const feedItems: Item[] = [];

  for (const result of results) {
    for (const content of result.contents) {
      if (!content) {
        continue;
      }

      // Extract locale and path from URL to match canonical OG URL pattern
      const url = new URL(content.url);
      const pathname = url.pathname; // e.g., "/en/articles/politics/my-article"
      const pathSegments = pathname.split("/").filter(Boolean);
      const locale = pathSegments[0]; // e.g., "en"
      const path = pathSegments.slice(1).join("/"); // e.g., "articles/politics/my-article"

      feedItems.push({
        title: content.metadata.title,
        description: content.metadata.description ?? content.metadata.title,
        link: content.url,
        date: new Date(content.metadata.date),
        id: content.url,
        author: content.metadata.authors,
        image: `${baseUrl}/${locale}/og/${path}/image.png`,
      });
    }
  }

  // Add Quran surahs to feed
  const surahs = getAllSurah();
  for (const locale of locales) {
    for (const surah of surahs) {
      const title = getSurahName({ locale, name: surah.name });
      const translation =
        surah.name.translation[locale] || surah.name.translation.en;

      feedItems.push({
        title: `${surah.number}. ${title}`,
        description: translation,
        link: `${baseUrl}/${locale}/quran/${surah.number}`,
        date: new Date("2025-01-01"), // Static date for Quran content
        id: `/${locale}/quran/${surah.number}`,
        image: `${baseUrl}/og.png`, // Default OG image for Quran
      });
    }
  }

  // Sort by date (newest first) and add to feed
  const sortedItems = feedItems.sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
  for (const item of sortedItems) {
    feed.addItem(item);
  }

  return new NextResponse(feed.rss2());
}

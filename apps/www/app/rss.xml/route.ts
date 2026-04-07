import { getContentsMetadata } from "@repo/contents/_lib/metadata";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import { parseContentDate } from "@repo/contents/_shared/date";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export const revalidate = false;

const baseUrl = "https://nakafa.com";

export async function GET() {
  const locales = routing.locales;

  const { t, tCommon } = await Effect.runPromise(
    Effect.all(
      {
        t: Effect.tryPromise({
          try: () =>
            getTranslations({
              namespace: "Metadata",
              locale: routing.defaultLocale,
            }),
          catch: () => new Error("Failed to load metadata translations"),
        }),
        tCommon: Effect.tryPromise({
          try: () =>
            getTranslations({
              namespace: "Common",
              locale: routing.defaultLocale,
            }),
          catch: () => new Error("Failed to load common translations"),
        }),
      },
      {
        concurrency: "unbounded",
      }
    )
  );

  // Fetch all articles and subjects for all locales in parallel
  const contentRequests = locales.flatMap((locale) => [
    Effect.map(
      getContentsMetadata({ locale, basePath: "articles" }),
      (contents) => ({
        locale,
        contents,
      })
    ),
    Effect.map(
      getContentsMetadata({ locale, basePath: "subject" }),
      (contents) => ({
        locale,
        contents,
      })
    ),
  ]);

  const results = await Effect.runPromise(
    Effect.all(contentRequests, {
      concurrency: "unbounded",
    })
  );

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

      const publishedAt = parseContentDate(content.metadata.date);
      if (!publishedAt) {
        continue;
      }

      feedItems.push({
        title: content.metadata.title,
        description: content.metadata.description ?? content.metadata.title,
        link: content.url,
        date: publishedAt,
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

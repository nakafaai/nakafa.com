import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import { getContents } from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { Feed, type Item } from "feed";
import { cacheLife } from "next/cache";
import { NextResponse } from "next/server";

const baseUrl = "https://nakafa.com";

export async function GET() {
  const locales = routing.locales;

  const results = await fetchContents();

  const feed = new Feed({
    title: "Nakafa: Free High-Quality Learning Platform (K-12 to University)",
    description:
      "Access free, high-quality learning resources on Nakafa. Covering K-12, university subjects (Math, Science, CS, AI), exam prep & more. Start learning!",
    id: `${baseUrl}`,
    link: `${baseUrl}`,
    language: routing.defaultLocale,
    image: `${baseUrl}/og.png`,
    favicon: `${baseUrl}/icon.png`,
    copyright:
      "Copyright © 2025 PT. Nakafa Tekno Kreatif. All rights reserved.",
  });

  // Collect all feed items
  const feedItems: Item[] = [];

  for (const result of results) {
    for (const content of result.contents) {
      feedItems.push({
        title: content.metadata.title,
        description: content.metadata.description ?? content.metadata.title,
        link: `${baseUrl}${content.url}`,
        date: new Date(content.metadata.date),
        id: content.url,
        author: content.metadata.authors,
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

async function fetchContents() {
  "use cache";
  cacheLife("max");
  // Fetch all articles and subjects for all locales in parallel
  const contentPromises = routing.locales.flatMap((locale) => [
    getContents({ locale, basePath: "articles" }).then((contents) => ({
      locale,
      contents,
    })),
    getContents({ locale, basePath: "subject" }).then((contents) => ({
      locale,
      contents,
    })),
  ]);

  const results = await Promise.all(contentPromises);

  return results;
}

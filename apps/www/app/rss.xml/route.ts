import { getContents } from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

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

  // Sort by date (newest first) and add to feed
  const sortedItems = feedItems.sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
  for (const item of sortedItems) {
    feed.addItem(item);
  }

  return new NextResponse(feed.rss2());
}

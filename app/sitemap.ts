import { getPathname, routing } from "@/i18n/routing";
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";

// Adapt this as necessary
const host = "https://nakafa.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...getEntries("/"),
    ...getEntries("/articles"),
    ...getEntries("/articles/politics"),
    ...getEntries("/subject"),
    ...getEntries("/subject/university"),
    ...getEntries("/subject/senior-high-school"),
    ...getEntries("/subject/junior-high-school"),
    ...getEntries("/subject/elementary-school"),
  ];
}

type Href = Parameters<typeof getPathname>[number]["href"];

function getEntries(href: Href) {
  return routing.locales.map((locale) => ({
    url: getUrl(href, locale),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((cur) => [cur, getUrl(href, cur)])
      ),
    },
  }));
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getPathname({ locale, href });
  return host + pathname;
}

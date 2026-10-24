import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import { TRAINING_CRAWLERS } from "@/lib/seo/crawlers";
import { CONTENT_LICENSE_URL, TDMREP_PATH } from "@/lib/seo/license";

/**
 * Renders the robots.txt of the production origin. The `*` group allows every
 * crawler, the answer and user-fetch crawlers included. The training-only tokens
 * of the registry form one group that disallows the whole site, and the sitemap
 * names the production sitemap.
 */
export function renderRobotsTxt() {
  const lines = [
    `# Nakafa content is licensed under ${CONTENT_LICENSE_URL}`,
    "# Search engines, AI answer services and user-requested fetches may read and cite every page.",
    `# Model training is reserved: ${new URL(TDMREP_PATH, SITE_ORIGIN).href}`,
    "",
    "User-Agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "Allow: /",
    "",
    ...Arr.map(TRAINING_CRAWLERS, ({ token }) => `User-Agent: ${token}`),
    "Disallow: /",
    "",
    `Sitemap: ${new URL("/sitemap.xml", SITE_ORIGIN).href}`,
  ];
  return `${Arr.join(lines, "\n")}\n`;
}

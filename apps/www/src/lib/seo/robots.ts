import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import { TRAINING_CRAWLERS } from "#www/src/lib/seo/crawlers";
import { CONTENT_LICENSE_URL, TDMREP_PATH } from "#www/src/lib/seo/license";

/**
 * Renders the robots.txt of the production origin. The `*` group allows every
 * crawler, the answer and user-fetch crawlers included, and its Content-Signal
 * states the training reservation. The training-only tokens of the registry form
 * one group that disallows the whole site, and the sitemap names the production
 * sitemap. Google-Extended is not a training-only token: Google reads it for
 * Gemini grounding as well, so refusing it would refuse an answer service, and the
 * comment says so.
 */
export function renderRobotsTxt() {
  const lines = [
    `# Nakafa content is licensed under ${CONTENT_LICENSE_URL}`,
    "# Search engines, AI answer services and user-requested fetches may read and cite every page.",
    `# Model training is reserved: ${new URL(TDMREP_PATH, SITE_ORIGIN).href}`,
    "# Content-Signal states that reservation to every crawler, and the crawlers below that only train are refused.",
    "# Google-Extended stays allowed, because Google reads that one token for Gemini grounding as well as for training.",
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

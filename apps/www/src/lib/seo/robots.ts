import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import { TRAINING_CRAWLERS } from "#www/src/lib/seo/crawlers";
import { CONTENT_USE_POLICY } from "#www/src/lib/seo/license";

/**
 * Renders the robots.txt of the production origin. The comments state the content
 * use policy. The `*` group allows every crawler, the answer and user-fetch
 * crawlers included. The training-only tokens of the registry form one group that
 * disallows the whole site, and the sitemap names the production sitemap. Every
 * other line is a comment, because a parser such as Lighthouse's reports an
 * unknown directive, and a policy line that no crawler enforces belongs in a
 * comment. Google-Extended is not a training-only token: Google reads it for
 * Gemini grounding as well, so refusing it would refuse an answer service, and the
 * comment says so.
 */
export function renderRobotsTxt() {
  const lines = [
    ...Arr.map(CONTENT_USE_POLICY, (line) => `# ${line}`),
    "# The crawlers below that only train are refused.",
    "# Google-Extended stays allowed, because Google reads that one token for Gemini grounding as well as for training.",
    "",
    "User-Agent: *",
    "Allow: /",
    "",
    ...Arr.map(TRAINING_CRAWLERS, ({ token }) => `User-Agent: ${token}`),
    "Disallow: /",
    "",
    `Sitemap: ${new URL("/sitemap.xml", SITE_ORIGIN).href}`,
  ];
  return `${Arr.join(lines, "\n")}\n`;
}

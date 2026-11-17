import { Schema } from "effect";

const TITLE_LENGTH = 55;
const TITLE_SEPARATOR = " - ";

/** What a page is, which decides whether its title names the site. */
export const PageKind = Schema.Literals([
  "account",
  "article",
  "curriculum",
  "home",
  "hub",
  "legal",
  "lesson",
  "marketing",
  "quran",
  "tryout",
]);

export type PageKind = typeof PageKind.Type;

/**
 * Whether a page's title ends in the site name. A lesson, an article, a try-out
 * page, a curriculum or program page and a surah are found by what a learner
 * searches for, so their title gives the whole budget to that and names no site:
 * a search result shows the site's name above the title, from the site's WebSite
 * data, its `og:site_name` and its address. The home, a hub that lists many pages
 * under a plain name (Articles, Al-Qur'an), and the marketing, legal and account
 * pages are about Nakafa itself, so they keep its name.
 */
const NAMES_SITE = {
  account: true,
  article: false,
  curriculum: false,
  home: true,
  hub: true,
  legal: true,
  lesson: false,
  marketing: true,
  quran: false,
  tryout: false,
} satisfies Record<PageKind, boolean>;

/**
 * Fits prioritized title parts, and the site name where the page's kind names it
 * (`NAMES_SITE`), within the app's title budget. The first part stays whole, and
 * stands alone when it leaves no room for the site name: two lessons named alike
 * up to their last word would read the same if it were cut, and a search result
 * shortens a long title by itself.
 */
export function createSEOTitle(
  parts: readonly (string | undefined)[],
  kind: PageKind,
  siteName = "Nakafa"
): string {
  const site = truncateAtWordBoundary(siteName, TITLE_LENGTH);
  if (!NAMES_SITE[kind]) {
    return fitParts(parts, TITLE_LENGTH) || site;
  }
  const contentLength = TITLE_LENGTH - TITLE_SEPARATOR.length - site.length;
  if (contentLength <= 0) {
    return site;
  }
  const title = fitParts(parts, contentLength);
  if (!title) {
    return site;
  }
  return title.length > contentLength
    ? title
    : `${title}${TITLE_SEPARATOR}${site}`;
}

/**
 * Joins the parts that fit `budget`, from the first, and stops at the first that
 * does not. The first part is kept whole even when it alone exceeds the budget.
 */
function fitParts(parts: readonly (string | undefined)[], budget: number) {
  let title = "";
  for (const part of parts) {
    const text = part?.trim();
    if (!text) {
      continue;
    }
    if (!title) {
      title = text;
      if (text.length > budget) {
        break;
      }
      continue;
    }
    const candidate = `${title}${TITLE_SEPARATOR}${text}`;
    if (candidate.length > budget) {
      break;
    }
    title = candidate;
  }
  return title;
}

/** Keeps complete trailing words when the site name exceeds the budget. */
function truncateAtWordBoundary(text: string, length: number) {
  if (text.length <= length) {
    return text;
  }
  const truncated = text.slice(0, length);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
}

import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";

/**
 * Converts an absolute or relative content URL into Nakafa's canonical origin.
 */
export function getCanonicalNakafaContentUrl(url: string) {
  const parsedUrl = new URL(url, "https://nakafa.com");
  const slug = cleanSlug(parsedUrl.pathname);

  return `https://nakafa.com/${slug}`;
}

/**
 * Builds the canonical public Nakafa URL for the current chat page projection.
 */
export function getCanonicalCurrentPageContentUrl({
  locale,
  slug,
}: {
  locale: Locale;
  slug: string;
}) {
  return getCanonicalNakafaContentUrl(`/${locale}/${cleanSlug(slug)}`);
}

/**
 * Normalizes absolute and relative content URLs to a comparable slug.
 */
function normalizeContentRefUrl(url: string) {
  const canonicalUrl = getCanonicalNakafaContentUrl(url);
  const parsedUrl = new URL(canonicalUrl, "https://nakafa.com");
  return cleanSlug(parsedUrl.pathname);
}

/**
 * Checks whether the retained chat context already contains a successful
 * current-page content fetch for the normalized URL.
 */
export function hasFetchedCurrentPageContent({
  messages,
  url,
}: {
  messages: MyUIMessage[];
  url: string;
}) {
  const currentUrl = normalizeContentRefUrl(url);

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "data-nakafa") {
        continue;
      }

      if (part.data.kind !== "content") {
        continue;
      }

      if (part.data.status !== "done") {
        continue;
      }

      const resultUrl = normalizeContentRefUrl(part.data.result.url);

      if (resultUrl === currentUrl) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Decides whether the verified current page still needs a content fetch.
 */
export function determinePageFetchNeed({
  messages,
  url,
  verified,
}: {
  messages: MyUIMessage[];
  url: string;
  verified: boolean;
}) {
  if (!verified) {
    return false;
  }

  const fetched = hasFetchedCurrentPageContent({ messages, url });
  return !fetched;
}

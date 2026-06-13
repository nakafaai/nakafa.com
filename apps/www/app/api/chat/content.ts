import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect } from "effect";

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
function normalizeContentUrl(url: string) {
  const parsedUrl = new URL(url, "https://nakafa.com");
  return cleanSlug(parsedUrl.pathname);
}

/**
 * Checks whether the retained chat context already contains a successful
 * current-page content fetch for the normalized URL.
 */
export const hasFetchedCurrentPageContent = Effect.fn(
  "chat.hasFetchedCurrentPageContent"
)(function* ({ messages, url }: { messages: MyUIMessage[]; url: string }) {
  const currentUrl = yield* Effect.sync(() => normalizeContentUrl(url));

  return yield* Effect.sync(() =>
    messages.some((message) =>
      message.parts.some((part) => {
        if (part.type !== "data-nakafa") {
          return false;
        }

        if (part.data.kind !== "content") {
          return false;
        }

        if (part.data.status !== "done") {
          return false;
        }

        return normalizeContentUrl(part.data.result.url) === currentUrl;
      })
    )
  );
});

/**
 * Decides whether the verified current page still needs a content fetch.
 */
export const determinePageFetchNeed = Effect.fn("chat.determinePageFetchNeed")(
  function* ({
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

    const fetched = yield* hasFetchedCurrentPageContent({ messages, url });
    return !fetched;
  }
);

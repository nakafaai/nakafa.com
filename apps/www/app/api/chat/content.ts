import type { MyUIMessage } from "@repo/ai/types/message";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect } from "effect";

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
        if (part.type !== "data-get-content") {
          return false;
        }

        if (part.data.status !== "done") {
          return false;
        }

        return normalizeContentUrl(part.data.url) === currentUrl;
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

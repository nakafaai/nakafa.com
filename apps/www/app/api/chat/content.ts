import type { MyUIMessage } from "@repo/ai/types/message";
import { type Locale, LocaleSchema } from "@repo/contents/_types/content";
import { findPublicRouteByPathEffect } from "@repo/contents/_types/route/projection";
import type {
  PublicContentRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option, Schema } from "effect";

/**
 * Converts an absolute or relative content URL into Nakafa's canonical origin.
 */
export function getCanonicalNakafaContentUrl(url: string) {
  const parsedUrl = new URL(url, "https://nakafa.com");
  const slug = cleanSlug(parsedUrl.pathname);

  return `https://nakafa.com/${slug}`;
}

/** Maps a public content URL to the source-backed URL expected by agent refs. */
export const getCanonicalNakafaContentRefUrlEffect = Effect.fn(
  "chat.canonicalContentRefUrl"
)(function* (url: string) {
  const canonicalUrl = getCanonicalNakafaContentUrl(url);
  const parsedUrl = new URL(canonicalUrl);
  const [rawLocale, ...routeParts] = cleanSlug(parsedUrl.pathname)
    .split("/")
    .filter(Boolean);
  const localeOption = Schema.decodeUnknownOption(LocaleSchema)(rawLocale);

  if (Option.isNone(localeOption)) {
    return canonicalUrl;
  }

  const routeOption = yield* findPublicRouteByPathEffect(
    routeParts.join("/"),
    localeOption.value
  );

  if (Option.isNone(routeOption) || !isPublicContentRoute(routeOption.value)) {
    return canonicalUrl;
  }

  return `https://nakafa.com/${localeOption.value}/${routeOption.value.sourcePath}`;
});

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
const normalizeContentUrlEffect = Effect.fn("chat.normalizeContentUrl")(
  function* (url: string) {
    const canonicalUrl = yield* getCanonicalNakafaContentRefUrlEffect(url);
    const parsedUrl = new URL(canonicalUrl, "https://nakafa.com");
    return cleanSlug(parsedUrl.pathname);
  }
);

function isPublicContentRoute(route: PublicRoute): route is PublicContentRoute {
  return (
    route.kind === "subject-topic" ||
    route.kind === "subject-lesson" ||
    route.kind === "exercise-set" ||
    route.kind === "exercise-question"
  );
}

/**
 * Checks whether the retained chat context already contains a successful
 * current-page content fetch for the normalized URL.
 */
export const hasFetchedCurrentPageContent = Effect.fn(
  "chat.hasFetchedCurrentPageContent"
)(function* ({ messages, url }: { messages: MyUIMessage[]; url: string }) {
  const currentUrl = yield* normalizeContentUrlEffect(url);

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

      const resultUrl = yield* normalizeContentUrlEffect(part.data.result.url);

      if (resultUrl === currentUrl) {
        return true;
      }
    }
  }

  return false;
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

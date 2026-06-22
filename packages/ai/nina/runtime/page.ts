import type { MyUIMessage } from "@repo/ai/types/message";
import { cleanSlug } from "@repo/utilities/helper";

/** Converts an absolute or relative content URL into Nakafa's canonical origin. */
export function getCanonicalNakafaContentUrl(url: string) {
  const parsedUrl = new URL(url, "https://nakafa.com");
  const slug = cleanSlug(parsedUrl.pathname);

  return `https://nakafa.com/${slug}`;
}

/** Coordinates the one permitted current-page fetch across repair and execution. */
export function createPageFetchState(needsPageFetch: boolean) {
  let consumed = false;
  let repairReservation = false;

  /** Reserves the one current-page fetch for a repaired Nakafa tool call. */
  function reserveForRepair() {
    if (consumed || !needsPageFetch) {
      return false;
    }

    consumed = true;
    repairReservation = true;
    return true;
  }

  /** Claims the current-page fetch for a Nakafa tool execution. */
  function consumeForTool() {
    if (repairReservation) {
      repairReservation = false;
      return true;
    }

    if (consumed || !needsPageFetch) {
      return false;
    }

    consumed = true;
    return true;
  }

  return {
    consumeForTool,
    reserveForRepair,
  };
}

/** Normalizes absolute and relative content URLs to a comparable slug. */
function normalizeContentRefUrl(url: string) {
  const canonicalUrl = getCanonicalNakafaContentUrl(url);
  const parsedUrl = new URL(canonicalUrl, "https://nakafa.com");
  return cleanSlug(parsedUrl.pathname);
}

/** Checks whether retained chat context already has current-page evidence. */
export function hasFetchedCurrentPageContent({
  messages,
  url,
}: {
  readonly messages: MyUIMessage[];
  readonly url: string;
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

/** Decides whether the verified current page still needs a content fetch. */
export function determinePageFetchNeed({
  messages,
  url,
  verified,
}: {
  readonly messages: MyUIMessage[];
  readonly url: string;
  readonly verified: boolean;
}) {
  if (!verified) {
    return false;
  }

  return !hasFetchedCurrentPageContent({ messages, url });
}

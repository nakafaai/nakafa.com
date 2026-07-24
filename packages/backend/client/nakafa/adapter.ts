import { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { PublicContentTarget } from "@repo/backend/client/content/request";
import { readNakafaMarkdown } from "@repo/backend/client/nakafa/markdown";
import { readNakafaQuranReference } from "@repo/backend/client/nakafa/quran";
import { readNakafaTaxonomy } from "@repo/backend/client/nakafa/taxonomy";
import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";

interface ConvexNakafaOptions {
  convexUrl: string;
  runtimeToken: string;
  siteUrl: string;
}

/** Creates the Convex-backed Nakafa read model adapter for apps and MCP. */
export function makeConvexNakafa({
  convexUrl,
  runtimeToken,
  siteUrl,
}: ConvexNakafaOptions) {
  const contentTarget: PublicContentTarget = {
    siteUrl,
    token: runtimeToken,
  };

  return Nakafa.make({
    /** Reads signed public markdown without exposing executable artifacts. */
    read: (input) => readNakafaMarkdown(convexUrl, contentTarget, input),
    /** Reads Quran references from Convex Quran runtime rows. */
    quran: (input) => readNakafaQuranReference(convexUrl, input),
    /** Reads taxonomy from pure taxonomy constants plus Convex counts. */
    taxonomy: (locale) => readNakafaTaxonomy(convexUrl, locale),
    /** Verifies concrete runtime routes through the Convex route catalog. */
    verify: (input) => verifyNakafaContent(convexUrl, input),
  });
}

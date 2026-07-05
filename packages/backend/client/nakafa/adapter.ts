import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { readNakafaMarkdown } from "@repo/backend/client/nakafa/markdown";
import { readNakafaQuranReference } from "@repo/backend/client/nakafa/quran";
import { readNakafaTaxonomy } from "@repo/backend/client/nakafa/taxonomy";
import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";

interface ConvexNakafaOptions {
  convexUrl: string;
}

/** Creates the Convex-backed Nakafa read model adapter for apps and MCP. */
export function makeConvexNakafa({ convexUrl }: ConvexNakafaOptions) {
  return Nakafa.make({
    /** Reads markdown from Convex runtime rows instead of package files. */
    read: (input) => readNakafaMarkdown(convexUrl, input),
    /** Reads Quran references from Convex Quran runtime rows. */
    quran: (input) => readNakafaQuranReference(convexUrl, input),
    /** Reads taxonomy from pure taxonomy constants plus Convex counts. */
    taxonomy: (locale) => readNakafaTaxonomy(convexUrl, locale),
    /** Verifies concrete runtime routes through the Convex route catalog. */
    verify: (input) => verifyNakafaContent(convexUrl, input),
  });
}

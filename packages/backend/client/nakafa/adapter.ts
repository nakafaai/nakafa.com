import { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { ContentRuntimeTarget } from "@repo/backend/client/content/public";
import { readNakafaMarkdown } from "@repo/backend/client/nakafa/markdown";
import {
  readNakafaQuranReference,
  readNakafaQuranReferenceV2,
} from "@repo/backend/client/nakafa/quran";
import { readNakafaTaxonomy } from "@repo/backend/client/nakafa/taxonomy";
import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";

interface ConvexNakafaOptions {
  convexUrl: string;
  readContentTarget: () => ContentRuntimeTarget;
}

/** Creates the Convex-backed Nakafa read model adapter for apps and MCP. */
export function makeConvexNakafa({
  convexUrl,
  readContentTarget,
}: ConvexNakafaOptions) {
  return Nakafa.of({
    /** Reads markdown from the active Convex runtime model. */
    read: (input) => readNakafaMarkdown(convexUrl, readContentTarget, input),
    /** Reads Quran references from Convex Quran runtime rows. */
    quran: (input) => readNakafaQuranReference(convexUrl, input),
    /** Reads semantic Quran V2 references from the same signed rows. */
    quranV2: (input) => readNakafaQuranReferenceV2(convexUrl, input),
    /** Reads taxonomy from authenticated current Convex publications. */
    taxonomy: (locale) => readNakafaTaxonomy(convexUrl, locale),
    /** Verifies concrete runtime routes through the Convex route catalog. */
    verify: (input) => verifyNakafaContent(convexUrl, input),
  });
}

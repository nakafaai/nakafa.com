import {
  createPageFetchState,
  determinePageFetchNeed,
  getCanonicalNakafaContentUrl,
} from "@repo/ai/nina/runtime/page";
import type { MyUIMessage } from "@repo/ai/types/message";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import {
  NakafaAgentContentIdSchema,
  NakafaAgentContentRouteSchema,
  type NakafaAgentContentSummary,
  NakafaAgentContentUrlSchema,
  NakafaAgentMarkdownUrlSchema,
  type NakafaAgentSection,
} from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/contents/_types/content";
import { describe, expect, it } from "vitest";

const englishLocale = "en" satisfies Locale;
const materialSection = "material" satisfies NakafaAgentSection;

describe("nina/runtime/page", () => {
  it("lets a repaired Nakafa call consume the only current-page fetch", () => {
    const pageFetch = createPageFetchState(true);

    expect(pageFetch.reserveForRepair()).toBe(true);
    expect(pageFetch.consumeForTool()).toBe(true);
    expect(pageFetch.reserveForRepair()).toBe(false);
    expect(pageFetch.consumeForTool()).toBe(false);
  });

  it("lets the first normal Nakafa execution claim current-page fetch once", () => {
    const pageFetch = createPageFetchState(true);

    expect(pageFetch.consumeForTool()).toBe(true);
    expect(pageFetch.reserveForRepair()).toBe(false);
    expect(pageFetch.consumeForTool()).toBe(false);
  });

  it("rejects repair and execution claims when the page does not need fetching", () => {
    const pageFetch = createPageFetchState(false);

    expect(pageFetch.reserveForRepair()).toBe(false);
    expect(pageFetch.consumeForTool()).toBe(false);
  });

  it("canonicalizes absolute and relative Nakafa URLs to clean content refs", () => {
    expect(getCanonicalNakafaContentUrl("/en/subjects/math/")).toBe(
      "https://nakafa.com/en/subjects/math"
    );
    expect(
      getCanonicalNakafaContentUrl(
        "https://nakafa.com/en/subjects/math?tab=practice"
      )
    ).toBe("https://nakafa.com/en/subjects/math");
  });

  it("detects completed current-page content evidence in retained messages", () => {
    expect(
      determinePageFetchNeed({
        messages: [
          messageWithPart({ type: "text", text: "Visible answer." }),
          messageWithPart({
            id: "taxonomy",
            type: "data-nakafa",
            data: {
              kind: "taxonomy",
              status: "done",
              input: { locale: "en" },
              result: {
                content_counts: [],
                locale: "en",
                sections: [],
                tools: [],
              },
            },
          }),
          messageWithPart({
            id: "loading-content",
            type: "data-nakafa",
            data: {
              input: {
                content_ref: NakafaAgentContentRefInputSchema.make(
                  "https://nakafa.com/en/subjects/math"
                ),
              },
              kind: "content",
              status: "loading",
            },
          }),
          messageWithPart({
            id: "wrong-content",
            type: "data-nakafa",
            data: {
              kind: "content",
              status: "done",
              input: {
                content_ref: NakafaAgentContentRefInputSchema.make(
                  "https://nakafa.com/en/subjects/science"
                ),
              },
              result: contentSummary("https://nakafa.com/en/subjects/science"),
            },
          }),
          messageWithPart({
            id: "current-content",
            type: "data-nakafa",
            data: {
              kind: "content",
              status: "done",
              input: {
                content_ref: NakafaAgentContentRefInputSchema.make(
                  "https://nakafa.com/en/subjects/math"
                ),
              },
              result: contentSummary("https://nakafa.com/en/subjects/math/"),
            },
          }),
        ],
        url: "/en/subjects/math",
        verified: true,
      })
    ).toBe(false);
  });

  it("keeps page fetch disabled for unverified pages", () => {
    expect(
      determinePageFetchNeed({
        messages: [],
        url: "/en/subjects/math",
        verified: false,
      })
    ).toBe(false);
  });

  it("requests a page fetch for verified pages without retained content evidence", () => {
    expect(
      determinePageFetchNeed({
        messages: [],
        url: "/en/subjects/math",
        verified: true,
      })
    ).toBe(true);
  });
});

/** Creates a minimal assistant message with one UI part for page evidence tests. */
function messageWithPart(part: MyUIMessage["parts"][number]): MyUIMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [part],
  };
}

/** Creates a valid Nakafa content summary for current-page evidence tests. */
function contentSummary(url: string): NakafaAgentContentSummary {
  return {
    alignmentId: "alignment:math:vector",
    assetId: "asset:material:math:vector",
    conceptId: "concept:math:vector",
    content_id: NakafaAgentContentIdSchema.make("asset:material:math:vector"),
    description: "Vector material summary.",
    learningObjectId: "learning:math:vector",
    lensId: "lens:math:vector",
    locale: englishLocale,
    markdown_url: NakafaAgentMarkdownUrlSchema.make(
      "https://nakafa.com/en/subjects/math.md"
    ),
    route: NakafaAgentContentRouteSchema.make("subjects/math"),
    section: materialSection,
    title: "Vector Math",
    url: NakafaAgentContentUrlSchema.make(url),
  };
}

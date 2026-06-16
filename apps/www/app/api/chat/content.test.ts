// @vitest-environment node
import type { NakafaDataPart } from "@repo/ai/schema/data";
import type { MyUIMessage } from "@repo/ai/types/message";
import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  determinePageFetchNeed,
  getCanonicalCurrentPageContentUrl,
  getCanonicalNakafaContentUrl,
  hasFetchedCurrentPageContent,
} from "@/app/api/chat/content";

const currentContentUrl =
  "/id/material/lesson/mathematics/function-modeling/rational-function";

type ContentStatus = Extract<NakafaDataPart, { kind: "content" }>["status"];

/**
 * Returns a retained assistant message with one content-fetch data part.
 */
function contentMessage({
  url,
  status,
}: {
  url: string;
  status: ContentStatus;
}) {
  const contentRef = getCanonicalNakafaContentUrl(url);

  if (status === "loading") {
    return {
      id: `message-${status}`,
      role: "assistant",
      parts: [
        {
          id: `content-${status}`,
          type: "data-nakafa",
          data: {
            kind: "content",
            input: {
              content_ref: NakafaAgentContentRefInputSchema.make(contentRef),
            },
            status,
          },
        },
      ],
    } satisfies MyUIMessage;
  }

  if (status === "error") {
    return {
      id: `message-${status}`,
      role: "assistant",
      parts: [
        {
          id: `content-${status}`,
          type: "data-nakafa",
          data: {
            kind: "content",
            input: {
              content_ref: NakafaAgentContentRefInputSchema.make(contentRef),
            },
            status,
            error: "Not found",
          },
        },
      ],
    } satisfies MyUIMessage;
  }

  const parsedRef = parseNakafaContentRef(contentRef);

  if (Option.isNone(parsedRef)) {
    throw new Error(`Expected a valid content URL fixture: ${url}`);
  }

  return {
    id: `message-${status}`,
    role: "assistant",
    parts: [
      {
        id: `content-${status}`,
        type: "data-nakafa",
        data: {
          kind: "content",
          input: {
            content_ref: NakafaAgentContentRefInputSchema.make(contentRef),
          },
          status,
          result: {
            ...parsedRef.value,
            title: "Rational Function",
            description: "",
          },
        },
      },
    ],
  } satisfies MyUIMessage;
}

describe("app/api/chat/content", () => {
  it("canonicalizes relative page URLs for content_ref inputs", () => {
    expect(getCanonicalNakafaContentUrl(currentContentUrl)).toBe(
      "https://nakafa.com/id/material/lesson/mathematics/function-modeling/rational-function"
    );
  });

  it("canonicalizes current-page chat route projections", () => {
    expect(
      getCanonicalCurrentPageContentUrl({
        locale: "id",
        slug: "/quran/1",
      })
    ).toBe("https://nakafa.com/id/quran/1");
  });

  it.each([
    [
      "same absolute URL",
      `https://nakafa.com${currentContentUrl}`,
      "done",
      true,
    ],
    ["same relative URL", currentContentUrl, "done", true],
    [
      "different URL",
      "/id/material/lesson/mathematics/function-modeling/function-domain",
      "done",
      false,
    ],
    ["loading fetch", currentContentUrl, "loading", false],
    ["errored fetch", currentContentUrl, "error", false],
  ] as const)("handles %s", (_, url, status, expected) => {
    const messages = [contentMessage({ url, status })];

    expect(
      Effect.runSync(
        hasFetchedCurrentPageContent({ messages, url: currentContentUrl })
      )
    ).toBe(expected);
  });

  it("ignores message parts that are not content fetches", () => {
    const messages = [
      {
        id: "assistant-text",
        role: "assistant",
        parts: [{ type: "text", text: "Previous answer" }],
      },
    ] satisfies MyUIMessage[];

    expect(
      Effect.runSync(
        hasFetchedCurrentPageContent({ messages, url: currentContentUrl })
      )
    ).toBe(false);
  });

  it("ignores Nakafa data parts for other kinds", () => {
    const messages = [
      {
        id: "assistant-search",
        role: "assistant",
        parts: [
          {
            id: "search-1",
            type: "data-nakafa",
            data: {
              kind: "search",
              input: {
                limit: 1,
                locale: "id",
                offset: 0,
                queries: ["function"],
              },
              status: "loading",
            },
          },
        ],
      },
    ] satisfies MyUIMessage[];

    expect(
      Effect.runSync(
        hasFetchedCurrentPageContent({ messages, url: currentContentUrl })
      )
    ).toBe(false);
  });

  it("does not need a page fetch when the page is unverified", () => {
    const needsPageFetch = Effect.runSync(
      determinePageFetchNeed({
        messages: [],
        url: currentContentUrl,
        verified: false,
      })
    );

    expect(needsPageFetch).toBe(false);
  });

  it("needs a page fetch for a verified page without a retained fetch", () => {
    const needsPageFetch = Effect.runSync(
      determinePageFetchNeed({
        messages: [],
        url: currentContentUrl,
        verified: true,
      })
    );

    expect(needsPageFetch).toBe(true);
  });

  it("needs a page fetch for a verified canonical current-page URL", () => {
    const url = getCanonicalCurrentPageContentUrl({
      locale: "id",
      slug: "/quran/1",
    });
    const needsPageFetch = Effect.runSync(
      determinePageFetchNeed({
        messages: [],
        url,
        verified: true,
      })
    );

    expect(needsPageFetch).toBe(true);
  });

  it("does not need a page fetch after a retained successful fetch", () => {
    const messages = [
      contentMessage({ url: currentContentUrl, status: "done" }),
    ];
    const needsPageFetch = Effect.runSync(
      determinePageFetchNeed({
        messages,
        url: currentContentUrl,
        verified: true,
      })
    );

    expect(needsPageFetch).toBe(false);
  });
});

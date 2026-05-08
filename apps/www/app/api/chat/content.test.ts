import type { MyUIMessage } from "@repo/ai/types/message";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  determinePageFetchNeed,
  hasFetchedCurrentPageContent,
} from "@/app/api/chat/content";

const currentContentUrl =
  "/id/subject/high-school/11/mathematics/function-modeling/rational-function";

type ContentFetchPart = Extract<
  MyUIMessage["parts"][number],
  { type: "data-get-content" }
>;

/**
 * Returns a retained assistant message with one content-fetch data part.
 */
function contentMessage({
  url,
  status,
}: {
  url: string;
  status: ContentFetchPart["data"]["status"];
}) {
  return {
    id: `message-${status}`,
    role: "assistant",
    parts: [
      {
        id: `content-${status}`,
        type: "data-get-content",
        data: {
          url,
          title: "Rational Function",
          description: "",
          status,
        },
      },
    ],
  } satisfies MyUIMessage;
}

describe("app/api/chat/content", () => {
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
      "/id/subject/high-school/11/mathematics/function-modeling/function-domain",
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

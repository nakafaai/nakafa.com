import { describe, expect, it } from "@effect/vitest";
import {
  formatSearchLimit,
  formatWebSearchOutput,
} from "@repo/backend/confect/nina/research/search/format";
import { Array as Arr } from "effect";

/** The sites a call limited its search to. */
const sites = Arr.make("snpmb.bppp.kemdikbud.go.id", "bbc.com");

const page = {
  citation: "[example.com](https://example.com/a)",
  content: "Page text.",
  description: "A page.",
  title: "A page",
  url: "https://example.com/a",
};

describe("web search output text", () => {
  it("says an open search returned no usable source, and names no site", () => {
    expect(formatWebSearchOutput({ error: undefined, sources: [] })).toBe(
      Arr.join(
        [
          "# Web Search Results",
          "- No usable source URLs or page content were returned.",
          "",
          "Do not cite or describe source evidence from this result.",
        ],
        "\n"
      )
    );
  });

  it("tells the reader that a search limited to sites returned nothing from them, that a site named from memory may be wrong, and to research again without the limit unless the learner named them", () => {
    expect(
      formatWebSearchOutput({ error: undefined, sites, sources: [] })
    ).toBe(
      Arr.join(
        [
          "# Web Search Results",
          "- The search was limited to these sites: snpmb.bppp.kemdikbud.go.id, bbc.com.",
          "- No usable source URLs or page content were returned from them.",
          "- A site named from memory may be wrong or no longer in use.",
          "",
          "Do not cite or describe source evidence from this result.",
          "If the learner did not name these sites, research again without limiting the search to sites.",
        ],
        "\n"
      )
    );
  });

  it("reports a failed search as a failure, also when the call named sites", () => {
    const error = "Failed to search the web. Please try again.";
    const text = Arr.join(
      [
        "# Web Search Results",
        `- Error: ${error}`,
        "",
        "Do not cite or describe source evidence from this result.",
      ],
      "\n"
    );

    expect(formatWebSearchOutput({ error, sources: [] })).toBe(text);
    expect(formatWebSearchOutput({ error, sites, sources: [] })).toBe(text);
  });

  it("lists the sources of a limited search like any other, with no word of the limit", () => {
    const text = formatWebSearchOutput({
      error: undefined,
      sites,
      sources: [page, { ...page, content: "", url: "https://example.com/b" }],
    });

    expect(text).toContain("## Source 1: A page");
    expect(text).toContain("- URL: https://example.com/a");
    expect(text).toContain("### Content\nPage text.");
    expect(text).toContain("## Source 2: A page");
    expect(text).toContain(
      "- Page text: not read. Only the description above is known."
    );
    expect(text).not.toContain("limited");
  });
});

describe("limit of a search", () => {
  it("is the words a search limited to sites writes when it returned no source", () => {
    const limited = { error: undefined, sites, sources: [] };

    expect(formatSearchLimit(limited)).toEqual([
      formatWebSearchOutput(limited),
    ]);
  });

  it.each([
    ["an open search", { error: undefined, sources: [] }],
    [
      "a limited search that failed",
      { error: "Failed to search the web.", sites, sources: [] },
    ],
    [
      "a limited search that returned a source",
      { error: undefined, sites, sources: [page] },
    ],
  ])("is nothing for %s", (_case, output) => {
    expect(formatSearchLimit(output)).toEqual([]);
  });
});

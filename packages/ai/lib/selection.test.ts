import { selectRelevantContent } from "@repo/ai/lib/selection";
import { describe, expect, it } from "vitest";

describe("selectRelevantContent", () => {
  it("returns empty content unchanged", () => {
    expect(selectRelevantContent({ content: "   " })).toBe("");
  });

  it("returns short content without truncation", () => {
    expect(selectRelevantContent({ content: "Short content." })).toBe(
      "Short content."
    );
  });

  it("keeps bounded content intact when a query is present", () => {
    expect(
      selectRelevantContent({
        content: "Intro paragraph.\n\nCaptured data includes tool calls.",
        maxLength: 100,
        query: "tool calls",
      })
    ).toBe("Intro paragraph.\n\nCaptured data includes tool calls.");
  });

  it("falls back to content truncation when a query has no keywords", () => {
    expect(
      selectRelevantContent({
        content: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
        maxLength: 30,
        query: "is be do",
      })
    ).toBe("First paragraph.\n\nSecond parag...");
  });

  it("keeps short two-paragraph content intact", () => {
    expect(
      selectRelevantContent({
        content: "Alpha intro.\n\nBeta detail.",
        query: "alpha",
      })
    ).toBe("Alpha intro.\n\nBeta detail.");
  });

  it("uses paragraph boundaries when sentence boundaries are unavailable", () => {
    expect(
      selectRelevantContent({
        content: "aaaaaaaaaaaaaaaaaaaaaaaaa\n\nbbbbbbbbbbbbbbbbbbbb",
        maxLength: 35,
      })
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("uses sentence boundaries before paragraph boundaries", () => {
    expect(
      selectRelevantContent({
        content: "aaaaaaaaaaaaaaaaaaaaaaaaa. bbbbbbbbbbbbbbbbbbbbb",
        maxLength: 35,
      })
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaaa.");
  });

  it("uses newline boundaries when paragraph boundaries are unavailable", () => {
    expect(
      selectRelevantContent({
        content: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbbbbbbbbbbbbbbbbbbbb",
        maxLength: 40,
      })
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("uses word boundaries before hard truncation", () => {
    expect(
      selectRelevantContent({
        content: "aaaaaaaaaa bbbbbbbbbb cccccccc dddddddddd",
        maxLength: 34,
      })
    ).toBe("aaaaaaaaaa bbbbbbbbbb cccccccc...");
  });

  it("hard truncates when no clean boundary exists", () => {
    expect(
      selectRelevantContent({
        content: "abcdefghijklmnopqrstuvwxyz",
        maxLength: 10,
      })
    ).toBe("abcdefghij...");
  });

  it("preserves structure around relevant middle paragraphs", () => {
    const selected = selectRelevantContent({
      content:
        "Intro paragraph.\n\nRational function domain detail.\n\nRational rational function example.\n\nConclusion paragraph.",
      query: "rational domain missing",
    });

    expect(selected).toBe(
      "Intro paragraph.\n\nRational function domain detail.\n\nRational rational function example.\n\nConclusion paragraph."
    );
  });

  it("keeps introduction, relevant middle content, and conclusion when selecting from long structured content", () => {
    const selected = selectRelevantContent({
      content:
        "Intro frame.\n\nRational domain detail.\n\nUnrelated filler text.\n\nClosing note.",
      maxLength: 70,
      query: "rational",
    });

    expect(selected).toBe(
      "Intro frame.\n\nRational domain detail.\n\nClosing note."
    );
  });

  it("sorts multiple relevant middle paragraphs back into reading order", () => {
    const selected = selectRelevantContent({
      content:
        "Intro frame.\n\nRational rational domain detail.\n\nLong unrelated filler paragraph that makes the source exceed the selected budget.\n\nRational detail.\n\nClosing note.",
      maxLength: 100,
      query: "rational",
    });

    expect(selected).toBe(
      "Intro frame.\n\nRational rational domain detail.\n\nRational detail.\n\nClosing note."
    );
  });

  it("falls back to truncation when long content has only two paragraphs", () => {
    expect(
      selectRelevantContent({
        content:
          "First paragraph with enough text to exceed the selected budget.\n\nSecond paragraph with more relevant rational detail.",
        maxLength: 60,
        query: "rational",
      })
    ).toBe("First paragraph with enough text to exceed the selected...");
  });

  it("skips structured paragraphs that do not fit", () => {
    const selected = selectRelevantContent({
      content:
        "Intro paragraph that already takes room.\n\nRational function detail that is too long to fit inside the target selection budget.\n\nConclusion paragraph that also does not fit.",
      maxLength: 60,
      query: "rational",
    });

    expect(selected).toBe("Intro paragraph that already takes room.");
  });

  it("selects relevant paragraphs without preserving structure", () => {
    const selected = selectRelevantContent({
      content:
        "Intro paragraph.\n\nRational function domain detail.\n\nAnother rational function example.\n\nConclusion paragraph.",
      maxLength: 100,
      preserveStructure: false,
      query: "rational",
    });

    expect(selected).toBe(
      "Rational function domain detail.\n\nAnother rational function example."
    );
  });

  it("falls back to scraped content when no paragraph matches", () => {
    expect(
      selectRelevantContent({
        content:
          "Alpha introduction.\n\nBeta explanation.\n\nGamma closing paragraph.",
        preserveStructure: false,
        query: "unmatched",
      })
    ).toBe(
      "Alpha introduction.\n\nBeta explanation.\n\nGamma closing paragraph."
    );
  });

  it("falls back when matching paragraphs cannot fit the target budget", () => {
    expect(
      selectRelevantContent({
        content:
          "Alpha introduction.\n\nRational function paragraph that is far too long for the selected budget.\n\nGamma closing paragraph.",
        maxLength: 20,
        preserveStructure: false,
        query: "rational",
      })
    ).toBe("Alpha introduction.");
  });
});

import { normalizeResearchCitations } from "@repo/ai/agents/research/citation";
import { describe, expect, it } from "vitest";

describe("normalizeResearchCitations", () => {
  it("converts indexed research citations into markdown links", () => {
    const text = [
      "Agent workflows are becoming central [4, 21, 23].",
      "",
      "### Sources",
      "* [ByteByteGo](https://blog.bytebytego.com/p/whats-next-in-ai-five-trends-to-watch) [4]",
      "* [DevEssence](https://devessence.com/blog/ai-in-software-development-2026) [21]",
      "* [Karan Balaji](https://blog.karanbalaji.com/100-days-of-ai-day-5-open-source-ai-sdks-and-frameworks-2026) [23]",
    ].join("\n");

    expect(normalizeResearchCitations(text)).toContain(
      "Agent workflows are becoming central [ByteByteGo](https://blog.bytebytego.com/p/whats-next-in-ai-five-trends-to-watch) [DevEssence](https://devessence.com/blog/ai-in-software-development-2026) [Karan Balaji](https://blog.karanbalaji.com/100-days-of-ai-day-5-open-source-ai-sdks-and-frameworks-2026)."
    );
  });

  it("removes source-list index labels after preserving the links", () => {
    const text = [
      "Security matters [11].",
      "",
      "### Sources",
      "* [Checkmarx](https://checkmarx.com/learn/ai-security/top-12-ai-developer-tools-in-2026/) [11]",
    ].join("\n");

    const normalizedText = normalizeResearchCitations(text);

    expect(normalizedText).toContain(
      "* [Checkmarx](https://checkmarx.com/learn/ai-security/top-12-ai-developer-tools-in-2026/)"
    );
    expect(normalizedText).not.toContain(
      "* [Checkmarx](https://checkmarx.com/learn/ai-security/top-12-ai-developer-tools-in-2026/) [11]"
    );
  });

  it("leaves bracketed numbers alone when there is no source mapping", () => {
    const text = "Use the interval [2, 10] for this example.";

    expect(normalizeResearchCitations(text)).toBe(text);
  });

  it("leaves incomplete citation groups unchanged", () => {
    const text = [
      "One source is missing from this citation group [4, 99].",
      "",
      "### Sources",
      "* [ByteByteGo](https://blog.bytebytego.com/p/whats-next-in-ai-five-trends-to-watch) [4]",
    ].join("\n");

    expect(normalizeResearchCitations(text)).toContain(
      "One source is missing from this citation group [4, 99]."
    );
  });
});

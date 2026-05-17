import { describe, expect, it } from "vitest";
import { extractMdxText, renderMdxHtml } from "@/scripts/pagefind/mdx";

describe("Pagefind MDX rendering", () => {
  it("excludes agent-only context from user-facing search records", () => {
    const source = [
      "Visible question.",
      "",
      "<AgentContext>",
      "  Hidden model context.",
      "</AgentContext>",
    ].join("\n");

    expect(extractMdxText(source)).toBe("Visible question.");
    expect(renderMdxHtml(source)).toBe("<p>Visible question.</p>");
  });
});

import { describe, expect, it } from "@effect/vitest";
import { readLlmsMarkdownPathname } from "@/lib/llms/routes";

describe("llms Markdown pathname", () => {
  it("removes one Markdown suffix and names the page's .md twin", () => {
    expect(readLlmsMarkdownPathname("/en/articles/x.md")).toEqual({
      markdownExtension: ".md",
      pathname: "/en/articles/x",
    });
    expect(readLlmsMarkdownPathname("/en/articles/x.mdx")).toEqual({
      markdownExtension: ".md",
      pathname: "/en/articles/x",
    });
  });

  it("leaves a path without a Markdown suffix unchanged", () => {
    expect(readLlmsMarkdownPathname("/en/articles/x")).toEqual({
      markdownExtension: "",
      pathname: "/en/articles/x",
    });
  });
});

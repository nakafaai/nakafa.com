import { describe, expect, it, vi } from "vitest";
import { ENGLISH_LANGUAGE_NAMES } from "@/lib/llms/constants";
import {
  buildHeader,
  formatRouteTitle,
  formatSegmentTitle,
  getLocaleLabel,
  getTranslation,
  stripLlmsRouteExtension,
} from "@/lib/llms/format";

describe("llms formatting helpers", () => {
  it("builds markdown headers with optional source metadata", () => {
    expect(
      buildHeader({
        description: "Description",
        source:
          "packages/contents/articles/politics/dynastic-politics-asian-values/en.mdx",
        url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
      })
    ).toStrictEqual([
      "# Nakafa Framework: LLM",
      "",
      "> For AI agents: use [llms.txt](https://nakafa.com/llms.txt). Markdown versions are available by appending `.md` to content URLs or sending `Accept: text/markdown`.",
      "",
      "URL: https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
      "Source: packages/contents/articles/politics/dynastic-politics-asian-values/en.mdx",
      "",
      "Description",
      "",
      "---",
      "",
    ]);

    expect(
      buildHeader({
        description: "Description",
        url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
      })
    ).not.toContain("Source:");
  });

  it("formats locale labels, route titles, and markdown route slugs", () => {
    expect(getLocaleLabel("en")).toBe("English");

    const displayName = vi.spyOn(ENGLISH_LANGUAGE_NAMES, "of");
    displayName.mockReturnValueOnce(undefined);

    expect(getLocaleLabel("zz")).toBe("zz");

    displayName.mockRestore();
    expect(getTranslation({ en: "English", id: "" }, "id")).toBe("English");
    expect(formatRouteTitle("/")).toBe("Home");
    expect(formatRouteTitle("")).toBe("");
    expect(formatRouteTitle("/subject/high-school")).toBe("High School");
    expect(formatSegmentTitle("multi--dash-title")).toBe("Multi Dash Title");
    expect(stripLlmsRouteExtension("quran/1.md")).toBe("quran/1");
    expect(stripLlmsRouteExtension("llms/en/llms.txt")).toBe("llms/en/llms");
  });
});

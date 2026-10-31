// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { ENGLISH_LANGUAGE_NAMES } from "@/lib/llms/constants";
import {
  AGENT_MARKDOWN_DIRECTIVE,
  buildHeader,
  formatRouteTitle,
  getLlmsMarkdownPath,
  getLocaleLabel,
  getMdxDescription,
  readTwinTitle,
  stripLlmsRouteExtension,
} from "@/lib/llms/format";

describe("llms formatting helpers", () => {
  it("builds one same-origin markdown route from a published path", () => {
    expect(
      getLlmsMarkdownPath({
        locale: "en",
        publicPath: "subjects/mathematics/analytic-geometry/hyperbola",
      })
    ).toBe("/en/subjects/mathematics/analytic-geometry/hyperbola.md");
    expect(
      getLlmsMarkdownPath({
        locale: "id",
        publicPath: "///articles/education///",
      })
    ).toBe("/id/articles/education.md");
  });

  it("names the author, the dates, the license and a citation", () => {
    const header = buildHeader({
      citation: {
        authors: ["Nabil", "Shifna"],
        dateModified: "2026-02-01",
        datePublished: "2026-01-01",
      },
      description: "Description",
      title: "Numbers",
      url: "https://nakafa.com/en/subjects/numbers",
    });

    expect(header).toContain("Author: Nabil, Shifna");
    expect(header).toContain("Published: 2026-01-01");
    expect(header).toContain("Updated: 2026-02-01");
    expect(header).toContain(
      'Cite as: Nabil, Shifna, "Numbers", Nakafa, https://nakafa.com/en/subjects/numbers'
    );
    expect(
      buildHeader({
        citation: { authors: ["Nabil"], datePublished: "2026-01-01" },
        description: "Description",
        title: "Numbers",
        url: "https://nakafa.com/en/subjects/numbers",
      })
    ).not.toContain("Updated: 2026-02-01");
  });

  it("reads a twin's title from the header's first line", () => {
    expect(
      readTwinTitle(
        Arr.join(
          buildHeader({
            description: "Description",
            title: "Numbers",
            url: "https://nakafa.com/en/subjects/numbers",
          }),
          "\n"
        )
      )
    ).toBe("Numbers");
  });

  it("builds markdown headers with optional source metadata", () => {
    expect(
      buildHeader({
        description: "Description",
        source: "https://source.test/dynastic-politics/en.mdx",
        title: "Dynastic Politics",
        url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
      })
    ).toStrictEqual([
      "# Dynastic Politics",
      "",
      AGENT_MARKDOWN_DIRECTIVE,
      "",
      "URL: https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
      "Source: https://source.test/dynastic-politics/en.mdx",
      "",
      "Description",
      "",
      "---",
      "",
    ]);

    expect(
      buildHeader({
        description: "Description",
        title: "Dynastic Politics",
        url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
      })
    ).not.toContain("Source:");
  });

  it("points agents only to the Markdown routes that the site serves", () => {
    expect(AGENT_MARKDOWN_DIRECTIVE).toContain("`.md`");
    expect(AGENT_MARKDOWN_DIRECTIVE).not.toContain("Accept: text/markdown");
  });

  it("selects authored MDX descriptions without inventing content", () => {
    expect(
      getMdxDescription({
        description: "Authored description",
        subject: "Math",
      })
    ).toBe("Authored description");
    expect(getMdxDescription({ subject: "Math" })).toBe("Math");
    expect(getMdxDescription({})).toBe(
      "Output docs content for large language models."
    );
  });

  it("formats locale labels, route titles, and markdown route slugs", () => {
    expect(getLocaleLabel("en")).toBe("English");

    const displayName = vi.spyOn(ENGLISH_LANGUAGE_NAMES, "of");
    displayName.mockReturnValueOnce(undefined);

    expect(getLocaleLabel("zz")).toBe("zz");

    displayName.mockRestore();
    expect(formatRouteTitle("/")).toBe("Home");
    expect(formatRouteTitle("")).toBe("");
    expect(formatRouteTitle("/curriculum/merdeka")).toBe("Merdeka");
    expect(formatRouteTitle("/multi--dash-title")).toBe("Multi Dash Title");
    expect(stripLlmsRouteExtension("quran/1.md")).toBe("quran/1");
    expect(stripLlmsRouteExtension("llms/en/llms.txt")).toBe("llms/en/llms");
  });
});

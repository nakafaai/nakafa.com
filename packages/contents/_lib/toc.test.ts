import { describe, expect, it } from "@effect/vitest";
import { extractAllHeadingIds, getHeadings } from "@repo/contents/_lib/toc";
import type { ParsedHeading } from "@repo/contents/_types/toc";

describe("getHeadings", () => {
  it.each([
    "",
    "   \n\n   ",
    "Plain text\nwithout headings",
    "#Missing space",
    "####### Unsupported level",
  ])("ignores content without supported headings: %j", (content) => {
    expect(getHeadings(content)).toEqual([]);
  });

  it.each([
    ["# Main Heading", "Main Heading", "#main-heading"],
    ["   #   Multiple   Spaces   ", "Multiple   Spaces", "#multiple-spaces"],
    ["#\tTab Heading", "Tab Heading", "#tab-heading"],
    ["#", "", "#"],
    ["#      ", "", "#"],
    ["# 12345", "12345", "#12345"],
    ['## <InlineMath math="x^2" />', "x^2", "#x^2"],
  ])("keeps renderer labels and anchors for %j", (content, label, href) => {
    expect(getHeadings(content)).toEqual([{ label, href, children: [] }]);
  });

  it.each([
    "Heading with café 日本語 مرحبا",
    "Heading 🎉 with emoji 🚀",
    "Heading with **bold** and *italic*",
    "Heading with [link](https://example.com)",
    "Heading with `code`",
    "E = mc² and ∑ ∫ ∞",
    "Heading [with] {brackets} (parentheses)",
    "A".repeat(1000),
  ])("preserves authored heading text: %j", (label) => {
    expect(getHeadings(`# ${label}`)[0].label).toBe(label);
  });

  it.each([
    "```javascript\n# Fake\nconst x = 1;\n```",
    "~~~typescript\n# Fake\n~~~",
    '<CodeBlock code="# Fake" />',
    '```javascript\nconst str = "`not a heading`";\n# Fake\n```',
  ])("omits code examples from the hierarchy: %j", (example) => {
    const headings = getHeadings(`# Real\n\n${example}\n\n## Child`);
    expect(headings).toEqual([
      {
        label: "Real",
        href: "#real",
        children: [{ label: "Child", href: "#child", children: [] }],
      },
    ]);
  });

  it("preserves siblings, skipped levels and root order without stale ancestors", () => {
    const headings = getHeadings(
      "# First\n## Child\n### Grandchild\n## Sibling\n#### Deep\n# Second\n### Fresh\n# Third"
    );
    expect(headings).toEqual([
      {
        label: "First",
        href: "#first",
        children: [
          {
            label: "Child",
            href: "#child",
            children: [
              { label: "Grandchild", href: "#grandchild", children: [] },
            ],
          },
          {
            label: "Sibling",
            href: "#sibling",
            children: [{ label: "Deep", href: "#deep", children: [] }],
          },
        ],
      },
      {
        label: "Second",
        href: "#second",
        children: [{ label: "Fresh", href: "#fresh", children: [] }],
      },
      { label: "Third", href: "#third", children: [] },
    ]);
  });

  it("supports all six levels and returns to a new root", () => {
    const headings = getHeadings(
      "# L1\n## L2\n### L3\n#### L4\n##### L5\n###### L6\n# Next"
    );
    const deepest =
      headings[0].children[0].children[0].children[0].children[0].children[0];
    expect(deepest).toEqual({ label: "L6", href: "#l6", children: [] });
    expect(headings[1]).toEqual({ label: "Next", href: "#next", children: [] });
    expect(extractAllHeadingIds(headings)).toEqual([
      "l1",
      "l2",
      "l3",
      "l4",
      "l5",
      "l6",
      "next",
    ]);
  });

  it("places orphan headings at the root and binds descendants to the current branch", () => {
    const headings = getHeadings(
      "###### Orphan\n### Section\n##### Child\n## New\n#### Fresh"
    );
    expect(headings.map(({ label }) => label)).toEqual([
      "Orphan",
      "Section",
      "New",
    ]);
    expect(headings[0].children).toEqual([]);
    expect(headings[1].children.map(({ label }) => label)).toEqual(["Child"]);
    expect(headings[2].children.map(({ label }) => label)).toEqual(["Fresh"]);
  });

  it("preserves duplicate labels and mixed line endings", () => {
    const headings = getHeadings(
      "# Duplicate\n## Duplicate\r\n### Duplicate\n\n# End"
    );
    expect(extractAllHeadingIds(headings)).toEqual([
      "duplicate",
      "duplicate",
      "duplicate",
      "end",
    ]);
    expect(headings[0].children[0].children[0].label).toBe("Duplicate");
  });
});

describe("extractAllHeadingIds", () => {
  it("returns an empty list for an empty table of contents", () => {
    expect(extractAllHeadingIds([])).toEqual([]);
  });

  it("uses renderer IDs and preserves depth-first order without mutating the hierarchy", () => {
    const headings: ParsedHeading[] = [
      {
        label: "Root One",
        href: "#root-one",
        children: [
          { label: "C++ & Java", href: "#custom-anchor", children: [] },
          {
            label: "API v2.0",
            href: "#api-v2.0",
            children: [{ label: "", href: "#", children: [] }],
          },
        ],
      },
      { label: "Root Two", href: "#root-two", children: [] },
    ];
    const before = structuredClone(headings);
    expect(extractAllHeadingIds(headings)).toEqual([
      "root-one",
      "c++-&-java",
      "api-v2.0",
      "",
      "root-two",
    ]);
    expect(headings).toEqual(before);
  });
});

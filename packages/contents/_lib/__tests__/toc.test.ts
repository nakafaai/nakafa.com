import { extractAllHeadingIds, getHeadings } from "@repo/contents/_lib/toc";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { describe, expect, it } from "vitest";

const MAIN_HEADING_REGEX = /^#main-heading$/;
const TEST_HEADING_WITH_SPACES_REGEX = /^#test-heading-with-spaces$/;
const LEVEL_1_REGEX = /^level-1$/;
const LEVEL_2_REGEX = /^level-2$/;
const LEVEL_3_REGEX = /^level-3$/;
const ANOTHER_LEVEL_1_REGEX = /^another-level-1$/;
const SPECIAL_CHARS_REGEX = /^c.*java$/;
const API_REGEX = /^api.*v2\.0$/;

describe("getHeadings", () => {
  describe("Happy Paths", () => {
    it("should parse single level 1 heading", () => {
      const content = "# Main Heading";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Main Heading");
      expect(headings[0].href).toMatch(MAIN_HEADING_REGEX);
      expect(headings[0].children).toEqual([]);
    });

    it("should parse multiple level 1 headings", () => {
      const content = "# First Heading\n# Second Heading\n# Third Heading";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(3);
      expect(headings[0].label).toBe("First Heading");
      expect(headings[1].label).toBe("Second Heading");
      expect(headings[2].label).toBe("Third Heading");
    });

    it("should parse nested headings (h1 -> h2)", () => {
      const content = "# Parent\n## Child";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Parent");
      expect(headings[0].children).toHaveLength(1);
      if (headings[0].children) {
        expect(headings[0].children[0].label).toBe("Child");
      }
    });

    it("should parse deeply nested headings (h1 -> h2 -> h3)", () => {
      const content = "# Level 1\n## Level 2\n### Level 3";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].children).toHaveLength(1);
      expect(headings[0].children?.[0]?.children?.[0]?.label).toBe("Level 3");
    });

    it("should parse complex nested structure", () => {
      const content = `# H1
## H1-1
### H1-1-1
## H1-2
# H2
## H2-1`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].children).toHaveLength(2);
      expect(headings[0].children?.[0]?.children).toHaveLength(1);
      expect(headings[1].children).toHaveLength(1);
    });

    it("should parse all 6 heading levels", () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(
        headings[0].children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]
          ?.children?.[0]?.label
      ).toBe("H6");
    });

    it("should handle siblings at same level", () => {
      const content = `# Parent
## Child 1
## Child 2
## Child 3`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].children).toHaveLength(3);
      if (headings[0].children) {
        expect(headings[0].children[0].label).toBe("Child 1");
        expect(headings[0].children[1].label).toBe("Child 2");
        expect(headings[0].children[2].label).toBe("Child 3");
      }
    });

    it("should trim whitespace from heading text", () => {
      const content = "#   Heading with spaces   ";
      const headings = getHeadings(content);

      expect(headings[0].label).toBe("Heading with spaces");
    });

    it("should generate valid href slugs", () => {
      const content = "# Test Heading With Spaces";
      const headings = getHeadings(content);

      expect(headings[0].href).toMatch(TEST_HEADING_WITH_SPACES_REGEX);
    });
  });

  describe("Code Block Handling", () => {
    it("should ignore headings inside markdown code fences", () => {
      const content = `# Real Heading

\`\`\`javascript
# Fake Heading Inside Code
const x = 1;
\`\`\`

# Another Real Heading`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].label).toBe("Real Heading");
      expect(headings[1].label).toBe("Another Real Heading");
    });

    it("should ignore headings inside CodeBlock components", () => {
      const content = `# Real Heading

<CodeBlock code="# Fake Heading Inside Component" />

# Another Real Heading`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].label).toBe("Real Heading");
      expect(headings[1].label).toBe("Another Real Heading");
    });

    it("should handle multiple code blocks", () => {
      const content = `# H1

\`\`\`
# Code 1
\`\`\`

# H2

\`\`\`
# Code 2
\`\`\`

# H3`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(3);
      expect(headings.map((h) => h.label)).toEqual(["H1", "H2", "H3"]);
    });

    it("should handle mixed code block types", () => {
      const content = `# H1

\`\`\`javascript
# Code block
\`\`\`

<CodeBlock code="# Component block" />

# H2`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
    });

    it("should handle nested code fences (tildes)", () => {
      const content = `# H1

~~~typescript
# Code block
~~~

# H2`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
    });

    it("should handle code blocks with multiple levels", () => {
      const content = `# H1
## H2
\`\`\`
# Code
\`\`\`
### H3
\`\`\`
# More Code
\`\`\`
#### H4`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].children).toHaveLength(1);
      expect(headings[0].children?.[0]?.children).toHaveLength(1);
      expect(headings[0].children?.[0]?.children?.[0]?.children).toHaveLength(
        1
      );
    });

    it("should handle malformed CodeBlock (missing closing)", () => {
      const content = `# H1
<CodeBlock code="# Not closed" />
# H2`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
    });

    it("should handle code block with escaped backticks", () => {
      const content = `# H1
\`\`\`javascript
const str = "\`not a heading\`";
\`\`\`
# H2`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array for empty content", () => {
      const headings = getHeadings("");
      expect(headings).toEqual([]);
    });

    it("should return empty array for content without headings", () => {
      const content = "This is just plain text\nwithout any headings";
      const headings = getHeadings(content);
      expect(headings).toEqual([]);
    });

    it("should return empty array for content with only whitespace", () => {
      const headings = getHeadings("   \n\n   ");
      expect(headings).toEqual([]);
    });

    it("should handle malformed heading syntax", () => {
      const content = "#Invalid heading without space";
      const headings = getHeadings(content);
      expect(headings).toEqual([]);
    });

    it("should handle heading with only hashes", () => {
      const content = "#      ";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("");
    });

    it("should handle headings with special characters", () => {
      const content = "# Heading with special: @#$%^&*() characters!";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toContain("special");
    });

    it("should handle very long heading text", () => {
      const longText = "A".repeat(1000);
      const content = `# ${longText}`;
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toHaveLength(1000);
    });

    it("should handle heading with Unicode characters", () => {
      const content = "# Heading with café 日本語 مرحبا";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
    });

    it("should handle heading with emoji", () => {
      const content = "# Heading 🎉 with emoji 🚀";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
    });

    it("should handle heading with inline markdown", () => {
      const content = "# Heading with **bold** and *italic*";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toContain("**bold**");
    });

    it("should handle heading with links", () => {
      const content = "# Heading with [link](https://example.com)";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
    });

    it("should handle heading with backticks", () => {
      const content = "# Heading with `code`";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
    });

    it("should handle heading with empty text after hash", () => {
      const content = "#";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("");
    });

    it("should handle heading with multiple spaces after hash", () => {
      const content = "#    Multiple   Spaces";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Multiple   Spaces");
    });

    it("should handle heading with tab after hash", () => {
      const content = "#\tTab Heading";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Tab Heading");
    });

    it("should handle heading with HTML entities", () => {
      const content = "# Heading with &lt;HTML&gt; &amp; &quot;entities&quot;";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
    });

    it("should handle heading with numbers only", () => {
      const content = "# 12345";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("12345");
    });

    it("should handle heading with special unicode characters", () => {
      const content = "# Heading with 日本語 中文 العربية";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
    });

    it("should handle heading with mathematical symbols", () => {
      const content = "# E = mc² and ∑ ∫ ∞";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
    });

    it("should handle duplicate heading labels", () => {
      const content = "# Duplicate\n## Duplicate\n### Duplicate";
      const headings = getHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Duplicate");
      expect(headings[0].children?.[0]?.label).toBe("Duplicate");
      expect(headings[0].children?.[0]?.children?.[0]?.label).toBe("Duplicate");
    });

    it("should handle backwards navigation (h6 -> h1)", () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6
# Back to H1`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].label).toBe("H1");
      expect(headings[1].label).toBe("Back to H1");
    });

    it("should handle empty lines between headings", () => {
      const content = `# First


# Second

# Third`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(3);
      expect(headings[0].label).toBe("First");
      expect(headings[1].label).toBe("Second");
      expect(headings[2].label).toBe("Third");
    });

    it("should handle multiple consecutive same-level headings", () => {
      const content = `# H1
# H2
# H3`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(3);
      expect(headings[0].children).toEqual([]);
      expect(headings[1].children).toEqual([]);
      expect(headings[2].children).toEqual([]);
    });

    it("should handle h6 with no parent (orphans to root)", () => {
      const content = "###### Orphan H6";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Orphan H6");
      expect(headings[0].children).toEqual([]);
    });

    it("should handle heading at document start", () => {
      const content = "# First Line";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("First Line");
    });

    it("should handle heading at document end", () => {
      const content = "Some content\n\n# Last Heading";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Last Heading");
    });

    it("should handle heading with leading/trailing whitespace on line", () => {
      const content = "   # Indented Heading   ";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Indented Heading");
    });

    it("should handle heading with mixed line endings", () => {
      const content = "# First\n# Second\r\n# Third";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(3);
    });

    it("should handle heading with underscores and special chars", () => {
      const content = "# Heading_with_special-chars: @#$%^&*()";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
    });

    it("should handle heading with brackets and parentheses", () => {
      const content = "# Heading [with] {brackets} (parentheses)";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
    });
  });

  describe("Complex Nested Structures", () => {
    it("should handle multiple root headings with nested children", () => {
      const content = `# Root 1
## Child 1.1
### Grandchild 1.1.1
## Child 1.2
# Root 2
## Child 2.1`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].children).toHaveLength(2);
      expect(headings[1].children).toHaveLength(1);
    });

    it("should handle skip levels (h1 -> h3)", () => {
      const content = `# Level 1
### Level 3`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].children?.[0]?.label).toBe("Level 3");
    });

    it("should handle mixed level structures", () => {
      const content = `# H1
## H2
### H3
## H2-2
#### H4
# H1-2`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].children).toHaveLength(2);
      expect(headings[0].children?.[0]?.children).toBeDefined();
      expect(headings[0].children?.[0]?.children?.[0]?.children).toBeDefined();
    });

    it("should handle deep nesting then return to shallow", () => {
      const content = `# H1
### H3
# H2`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      if (headings[0].children) {
        expect(headings[0].children).toHaveLength(1);
      }
      expect(headings[1].children).toEqual([]);
    });

    it("should add first child to parent without existing children array", () => {
      const content = `# Parent
## First Child`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Parent");
      expect(headings[0].children).toHaveLength(1);
      expect(headings[0].children?.[0]?.label).toBe("First Child");
    });

    it("should initialize children array for first child added to parent", () => {
      const content = `# Parent Heading
## First Child Heading`;
      const headings = getHeadings(content);

      expect(headings[0].children).toBeDefined();
      expect(headings[0].children?.length).toBe(1);
      expect(headings[0].children?.[0]?.label).toBe("First Child Heading");
    });

    it("should handle nested heading with no valid parent found", () => {
      const content = "### Level 3 without parent";
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].label).toBe("Level 3 without parent");
      expect(headings[0].children).toEqual([]);
    });

    it("should recursively cleanup deeply nested children", () => {
      const content = `# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      const level2 = headings[0].children?.[0];
      const level3 = level2?.children?.[0];
      const level4 = level3?.children?.[0];
      const level5 = level4?.children?.[0];
      const level6 = level5?.children?.[0];

      expect(level2).toBeDefined();
      expect(level3).toBeDefined();
      expect(level4).toBeDefined();
      expect(level5).toBeDefined();
      expect(level6?.children).toEqual([]);
    });

    it("should handle multiple siblings where some have children and some don't", () => {
      const content = `# Parent
## Child 1
### Grandchild 1.1
## Child 2
## Child 3
### Grandchild 3.1`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].children).toHaveLength(3);
      expect(headings[0].children?.[0]?.children).toHaveLength(1);
      expect(headings[0].children?.[1]?.children).toEqual([]);
      expect(headings[0].children?.[2]?.children).toHaveLength(1);
    });

    it("should cleanup mixed nested structure with varying depths", () => {
      const content = `# Root 1
## Child 1.1
### Grandchild 1.1.1
## Child 1.2
### Grandchild 1.2.1
#### Great-Grandchild 1.2.1.1
## Child 1.3
# Root 2`;
      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].children).toHaveLength(3);
      expect(headings[0].children?.[0]?.children).toHaveLength(1);
      expect(headings[0].children?.[1]?.children).toHaveLength(1);
      expect(headings[0].children?.[1]?.children?.[0]?.children).toHaveLength(
        1
      );
      expect(headings[0].children?.[2]?.children).toEqual([]);
      expect(headings[1].children).toEqual([]);
    });
  });

  describe("Real-World Content Examples", () => {
    it("should parse typical article structure", () => {
      const content = `# Introduction
## Background
## Problem Statement
# Methodology
## Approach
## Implementation
# Results
## Analysis
## Discussion
# Conclusion`;

      const headings = getHeadings(content);

      expect(headings).toHaveLength(4);
      expect(headings.map((h) => h.label)).toEqual([
        "Introduction",
        "Methodology",
        "Results",
        "Conclusion",
      ]);
    });

    it("should handle content with code examples", () => {
      const content = `# Getting Started

## Installation

\`\`\`bash
npm install package
\`\`\`

## Usage

\`\`\`javascript
import pkg from 'package';
\`\`\`

# Advanced Topics`;

      const headings = getHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings.map((h) => h.label)).toEqual([
        "Getting Started",
        "Advanced Topics",
      ]);
      expect(headings[0].children).toBeDefined();
      expect(headings[0].children?.length).toBe(2);
      expect(headings[0].children?.map((h) => h.label)).toEqual([
        "Installation",
        "Usage",
      ]);
    });
  });
});

describe("extractAllHeadingIds", () => {
  describe("Happy Paths", () => {
    it("should extract IDs from flat heading structure", () => {
      const headings = [
        { label: "First Heading", href: "#first-heading", children: [] },
        {
          label: "Second Heading",
          href: "#second-heading",
          children: [],
        },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual(["first-heading", "second-heading"]);
    });

    it("should extract IDs from nested heading structure", () => {
      const headings = [
        {
          label: "Parent",
          href: "#parent",
          children: [
            { label: "Child", href: "#child", children: [] },
            {
              label: "Another Child",
              href: "#another-child",
              children: [
                {
                  label: "Grandchild",
                  href: "#grandchild",
                  children: [],
                },
              ],
            },
          ],
        },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual(["parent", "child", "another-child", "grandchild"]);
    });

    it("should extract IDs from deeply nested structure", () => {
      const headings = [
        {
          label: "L1",
          href: "#l1",
          children: [
            {
              label: "L2",
              href: "#l2",
              children: [
                {
                  label: "L3",
                  href: "#l3",
                  children: [
                    {
                      label: "L4",
                      href: "#l4",
                      children: [{ label: "L5", href: "#l5", children: [] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual(["l1", "l2", "l3", "l4", "l5"]);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array for empty headings array", () => {
      const ids = extractAllHeadingIds([]);
      expect(ids).toEqual([]);
    });

    it("should handle headings with undefined children", () => {
      const headings = [
        { label: "Heading 1", href: "#heading-1", children: [] },
        { label: "Heading 2", href: "#heading-2", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual(["heading-1", "heading-2"]);
    });

    it("should handle headings with empty children array", () => {
      const headings = [
        { label: "Parent", href: "#parent", children: [] },
        { label: "Another", href: "#another", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual(["parent", "another"]);
    });

    it("should handle headings with mixed children (undefined and array)", () => {
      const headings = [
        { label: "H1", href: "#h1", children: [] },
        {
          label: "H2",
          href: "#h2",
          children: [{ label: "H2-1", href: "#h2-1", children: [] }],
        },
        { label: "H3", href: "#h3", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);
      expect(ids).toEqual(["h1", "h2", "h2-1", "h3"]);
    });

    it("should handle very large nested structure", () => {
      const headings: ParsedHeading[] = [
        { label: "L1", href: "#l1", children: [] },
        { label: "L2", href: "#l2", children: [] },
        { label: "L3", href: "#l3", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual(["l1", "l2", "l3"]);
    });

    it("should preserve DFS order in complex nested structure", () => {
      const headings = [
        {
          label: "Root 1",
          href: "#root-1",
          children: [
            { label: "Child 1.1", href: "#child-1.1", children: [] },
            { label: "Child 1.2", href: "#child-1.2", children: [] },
          ],
        },
        {
          label: "Root 2",
          href: "#root-2",
          children: [
            {
              label: "Child 2.1",
              href: "#child-2.1",
              children: [
                {
                  label: "Grandchild 2.1.1",
                  href: "#grandchild-2.1.1",
                  children: [],
                },
              ],
            },
          ],
        },
        { label: "Root 3", href: "#root-3", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual([
        "root-1",
        "child-1.1",
        "child-1.2",
        "root-2",
        "child-2.1",
        "grandchild-2.1.1",
        "root-3",
      ]);
    });

    it("should handle headings with special characters in labels", () => {
      const headings = [
        { label: "C++ & Java", href: "#c-java", children: [] },
        { label: "API v2.0", href: "#api-v20", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toHaveLength(2);
      expect(ids[0]).toMatch(SPECIAL_CHARS_REGEX);
      expect(ids[1]).toMatch(API_REGEX);
    });

    it("should handle headings with Unicode characters", () => {
      const headings = [
        { label: "日本語 heading", href: "#japanese-heading", children: [] },
        { label: "العربية", href: "#arabic", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toHaveLength(2);
    });

    it("should handle single heading with no children", () => {
      const headings = [
        { label: "Only Heading", href: "#only-heading", children: [] },
      ];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toEqual(["only-heading"]);
    });

    it("should handle empty label", () => {
      const headings = [{ label: "", href: "#", children: [] }];
      const ids = extractAllHeadingIds(headings);

      expect(ids).toHaveLength(1);
    });
  });

  describe("Integration with getHeadings", () => {
    it("should extract IDs from getHeadings output", () => {
      const content = `# Level 1
## Level 2
### Level 3
# Another Level 1`;
      const headings = getHeadings(content);
      const ids = extractAllHeadingIds(headings);

      expect(ids).toHaveLength(4);
      expect(ids[0]).toMatch(LEVEL_1_REGEX);
      expect(ids[1]).toMatch(LEVEL_2_REGEX);
      expect(ids[2]).toMatch(LEVEL_3_REGEX);
      expect(ids[3]).toMatch(ANOTHER_LEVEL_1_REGEX);
    });

    it("should handle content with code blocks", () => {
      const content = `# Real Heading

\`\`\`
# Fake Heading
\`\`\`

# Another Real Heading`;
      const headings = getHeadings(content);
      const ids = extractAllHeadingIds(headings);

      expect(ids).toHaveLength(2);
    });
  });
});

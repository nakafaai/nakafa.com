// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  countWords,
  escapeHtml,
  extractMdxText,
  extractMdxTextFromRoot,
  normalizeText,
  renderMdxHtml,
  renderMdxHtmlFromRoot,
} from "@/scripts/pagefind/mdx";

describe("Pagefind MDX rendering", () => {
  it("normalizes text and escapes HTML entities for generated records", () => {
    expect(normalizeText("  satu\n\n dua\t tiga  ")).toBe("satu dua tiga");
    expect(countWords("  satu\n\ndua tiga  ")).toBe(3);
    expect(countWords("   ")).toBe(0);
    expect(escapeHtml(`A&B <tag attr="x"> 'quote'`)).toBe(
      "A&amp;B &lt;tag attr=&quot;x&quot;&gt; &#39;quote&#39;"
    );
  });

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

  it("renders common markdown blocks into compact semantic HTML", () => {
    const source = [
      "# Analisis A & B",
      "",
      "Paragraf **tebal** dan _miring_ dengan `x < y`.",
      "",
      "- Item satu",
      "- Item dua",
      "",
      "1. Langkah satu",
      "2. Langkah dua",
      "",
      "> Kutipan penting.",
      "",
      "```ts",
      'const nilai = "<aman>";',
      "```",
      "",
      "---",
    ].join("\n");

    expect(renderMdxHtml(source)).toBe(
      [
        '<h2 id="analisis-a-&-b">Analisis A &amp; B</h2>',
        "<p>Paragraf <strong>tebal</strong> dan <em>miring</em> dengan <code>x &lt; y</code>.</p>",
        "<ul><li><p>Item satu</p></li><li><p>Item dua</p></li></ul>",
        "<ol><li><p>Langkah satu</p></li><li><p>Langkah dua</p></li></ol>",
        "<blockquote><p>Kutipan penting.</p></blockquote>",
        "<pre><code>const nilai = &quot;&lt;aman&gt;&quot;;</code></pre>",
        "<hr />",
      ].join("")
    );
  });

  it("keeps searchable visible text from links, images, and JSX attributes", () => {
    const source = [
      "[Dokumen resmi](https://example.test)",
      "",
      "[https://fallback.test]()",
      "",
      "![Diagram segitiga](./diagram.png)",
      "",
      '<Note label="Konteks penting">Isi catatan</Note>',
      "",
      "{hiddenExpression}",
    ].join("\n");

    expect(extractMdxText(source)).toBe(
      [
        "Dokumen resmi",
        "https://fallback.test",
        "Diagram segitiga",
        "Konteks penting",
        "Isi catatan",
      ].join(" ")
    );
    expect(renderMdxHtml(source)).toContain("<p>Dokumen resmi</p>");
    expect(renderMdxHtml(source)).toContain("<p>Diagram segitiga</p>");
    expect(renderMdxHtml(source)).toContain(
      "<p>Konteks penting Isi catatan</p>"
    );
  });

  it("handles malformed parser output defensively", () => {
    expect(renderMdxHtmlFromRoot(null)).toBe("");
    expect(extractMdxTextFromRoot(null)).toBe("");
    expect(renderMdxHtmlFromRoot({})).toBe("");
  });

  it("renders edge-case markdown AST nodes without leaking hidden context", () => {
    const ast = {
      children: [
        null,
        {},
        { type: "mdxjsEsm" },
        { type: "mdxFlowExpression" },
        { type: "mdxTextExpression" },
        { children: [], depth: 1, type: "heading" },
        {
          children: [{ type: "text", value: "Top Heading" }],
          depth: 1,
          type: "heading",
        },
        {
          children: [{ type: "text", value: "Deep Heading" }],
          depth: 9,
          type: "heading",
        },
        { children: null, type: "paragraph" },
        { children: null, ordered: false, type: "list" },
        { children: null, type: "listItem" },
        { type: "code", value: undefined },
        { children: null, type: "blockquote" },
        { type: "thematicBreak" },
        {
          attributes: [null, { value: "Attribute text" }, { value: 42 }],
          children: [{ type: "text", value: "Child text" }],
          type: "customNode",
        },
        {
          children: [
            null,
            {},
            {
              children: [{ type: "text", value: "Hidden text" }],
              name: "AgentContext",
              type: "mdxJsxTextElement",
            },
            { type: "inlineCode", value: "a < b" },
            {
              children: [{ type: "text", value: "bold" }],
              type: "strong",
            },
            {
              children: [{ type: "text", value: "em" }],
              type: "emphasis",
            },
            {
              children: [{ type: "text", value: "deleted" }],
              type: "delete",
            },
            {
              children: [],
              type: "link",
              url: "https://example.test?a=1&b=2",
            },
            {
              children: [],
              type: "link",
            },
            { type: "break" },
            { alt: "Alt text", type: "image" },
            {
              children: [{ type: "text", value: "fallback" }],
              type: "unknownInline",
            },
          ],
          type: "paragraph",
        },
      ],
    };

    expect(renderMdxHtmlFromRoot(ast)).toBe(
      [
        '<h2 id="top-heading">Top Heading</h2>',
        '<h6 id="deep-heading">Deep Heading</h6>',
        "<hr />",
        "<p>Attribute text Child text</p>",
        "<p><code>a &lt; b</code><strong>bold</strong><em>em</em><s>deleted</s>https://example.test?a=1&amp;b=2<br />Alt textfallback</p>",
      ].join("")
    );
    expect(extractMdxTextFromRoot(ast)).toBe(
      [
        "Top Heading",
        "Deep Heading",
        "Attribute text",
        "Child text",
        "a < b",
        "bold",
        "em",
        "deleted",
        "Alt text",
        "fallback",
      ].join(" ")
    );
  });
});

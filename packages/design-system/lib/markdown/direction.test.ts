import { describe, expect, it } from "@effect/vitest";
import { rehypeDirection } from "@repo/design-system/lib/markdown/direction";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** An item of a loose list: its paragraph has no direction of its own, so the item reads the text. */
const LOOSE_ITEM = /<li dir="auto">\s*<p>أ<\/p>/;
/** A paragraph inside a quote inside an item: the item cannot read it, so the paragraph does. */
const QUOTED_PARAGRAPH =
  /<li dir="auto">\s*<blockquote>\s*<p dir="auto">أ<\/p>/;

/** A response as the page renders it, without the components that style it. */
const render = (markdown: string) =>
  renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { rehypePlugins: [rehypeDirection], remarkPlugins: [remarkGfm] },
      markdown
    )
  );

describe("rehypeDirection", () => {
  it("lets a heading, a paragraph and a table cell read their own way", () => {
    const html = render(
      "## الاشتقاق\n\nنص.\n\n| أ | ب |\n| - | - |\n| ج | د |"
    );

    expect(html).toContain('<h2 dir="auto">');
    expect(html).toContain('<p dir="auto">');
    expect(html).toContain('<th dir="auto">');
    expect(html).toContain('<td dir="auto">');
  });

  it("lets a list item read its own text, in a tight list and in a loose one", () => {
    expect(render("- أ\n- ب")).toContain('<li dir="auto">أ</li>');
    expect(render("1. أ\n\n2. ب")).toMatch(LOOSE_ITEM);
  });

  it("leaves the paragraph of a list item to its item, which reads the same text", () => {
    const html = render("- أ\n\n- ب");

    expect(html).not.toContain("<p dir=");
  });

  it("marks a paragraph that a block inside a list item holds", () => {
    expect(render("- > أ")).toMatch(QUOTED_PARAGRAPH);
  });

  it("leaves the lists and the quotes themselves as they are", () => {
    const html = render("- أ\n\n> ب");

    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>");
  });
});

import { describe, expect, it } from "@effect/vitest";
import { rehypeLearnerText } from "@repo/design-system/lib/markdown/learner";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** Learner text as the page renders it, without the components that style it. */
const render = (markdown: string) =>
  renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        rehypePlugins: [rehypeLearnerText],
        remarkPlugins: [
          remarkGfm,
          [remarkMath, { singleDollarTextMath: false }],
        ],
      },
      markdown
    )
  );

describe("rehypeLearnerText", () => {
  it("keeps each line break a learner wrote inside a paragraph, a list item, a heading and a link", () => {
    expect(render("Baris satu\nBaris dua")).toBe(
      "<p>Baris satu<br/>Baris dua</p>"
    );
    expect(render("- satu\n  dua\n- tiga")).toContain("<li>satu<br/>dua</li>");
    expect(render("Judul\nbaris\n===")).toBe("<h1>Judul<br/>baris</h1>");
    expect(render("[satu\ndua](https://example.com)")).toContain(
      "satu<br/>dua</a>"
    );
  });

  it("keeps a line break between two inline runs and between lines of typed HTML", () => {
    expect(render("**Judul**\n*isi*")).toBe(
      "<p><strong>Judul</strong><br/><em>isi</em></p>"
    );
    expect(render("**Judul**\n[tautan](https://example.com)")).toBe(
      '<p><strong>Judul</strong><br/><a href="https://example.com">tautan</a></p>'
    );
    expect(render("**a**\n<b>c</b>")).toBe(
      "<p><strong>a</strong><br/>&lt;b&gt;c&lt;/b&gt;</p>"
    );
    expect(render("<li>Satu</li>\n<li>Dua</li>")).toBe(
      "&lt;li&gt;Satu&lt;/li&gt;<br/>&lt;li&gt;Dua&lt;/li&gt;"
    );
  });

  it("leaves the space between blocks, code and math as they are", () => {
    expect(render("- satu\n  - dua")).toBe(
      "<ul>\n<li>satu\n<ul>\n<li>dua</li>\n</ul>\n</li>\n</ul>"
    );
    expect(render("```\na\nb\n```")).toBe("<pre><code>a\nb\n</code></pre>");
    expect(render("`a\nb` c")).toBe("<p><code>a b</code> c</p>");
    expect(render("$$\na\nb\n$$")).toContain("a\nb");
  });

  it("keeps asterisks written inside words, so a product reads as written", () => {
    expect(render("2*3 + 4*5")).toBe("<p>2*3 + 4*5</p>");
    expect(render("2**3 + 4**5")).toBe("<p>2**3 + 4**5</p>");
    expect(render("a *b*c")).toBe("<p>a *b*c</p>");
    // Text that reads as HTML beside it draws no word, and shows as written.
    expect(render("x<br>*a*b")).toBe("<p>x&lt;br&gt;*a*b</p>");
  });

  it("draws the emphasis a learner meant", () => {
    expect(render("sangat *penting* dan **tebal**")).toBe(
      "<p>sangat <em>penting</em> dan <strong>tebal</strong></p>"
    );
    expect(render("_miring_ saja")).toBe("<p><em>miring</em> saja</p>");
  });
});

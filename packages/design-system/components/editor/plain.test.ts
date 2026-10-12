// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { richOptions } from "@repo/design-system/components/editor/extensions";
import { plainText } from "@repo/design-system/components/editor/plain";
import { decodeHtmlEntities, Editor, type JSONContent } from "@tiptap/core";
import { Array as Arr, Function as Fn, String as Str } from "effect";

/**
 * The editor of a memory with no page behind it: it reads and writes Markdown
 * exactly as the editor of the Memory page does, and shows its words as
 * `getText` gives them. These tests set that editor against `plainText`.
 */
function openEditor(content: JSONContent | string) {
  return new Editor({
    ...richOptions({ limit: 100_000, onRefuse: Fn.constVoid, placeholder: "" }),
    content,
    ...(typeof content === "string"
      ? { contentType: "markdown" as const }
      : {}),
    element: null,
  });
}

/** Every run of space as one space, and none at either end. */
function collapse(words: string) {
  return Str.trim(Str.replaceAll(/\s+/g, " ")(words));
}

/** The words the editor shows when it opens the stored Markdown. */
function shownBy(markdown: string) {
  const editor = openEditor(markdown);
  const words = collapse(editor.getText({ blockSeparator: " " }));

  editor.destroy();
  return words;
}

/** The Markdown the editor stores for a document. */
function writtenBy(doc: JSONContent) {
  const editor = openEditor(doc);
  const markdown = editor.getMarkdown();

  editor.destroy();
  return markdown;
}

type Marks = NonNullable<JSONContent["marks"]>;

const text = (words: string, marks: Marks = []): JSONContent => ({
  ...(Arr.isReadonlyArrayNonEmpty(marks) ? { marks } : {}),
  text: words,
  type: "text",
});

const paragraph = (...content: JSONContent[]): JSONContent => ({
  content,
  type: "paragraph",
});

const doc = (...content: JSONContent[]): JSONContent => ({
  content,
  type: "doc",
});

/** A list item with one paragraph of words in it, and what follows the paragraph. */
const item = (words: JSONContent, ...after: JSONContent[]): JSONContent => ({
  content: [paragraph(words), ...after],
  type: "listItem",
});

/** What the learner may type that a Markdown writer must treat with care. */
const WORST = [
  "I study C++ at university",
  "a == b",
  "Q&A",
  "a < b > c",
  "https://example.com/a?x=1&y=2",
  "**bold** typed as text",
  "[brackets] and (parens)",
  "snake_case_name and ~tilde~",
  "back\\slash and `tick`",
  "==",
  "++",
  "<b>not html</b>",
  "&amp; and &lt;b&gt; typed as text",
  "نور الهدى عبد الرحمن",
  "日本語のメモ",
  "🦊 Fox",
  " leading and trailing  ",
  "two  spaces   inside",
];

/** The marks the writer wraps around words, and a link whose address holds an ampersand. */
const MARKS: readonly Marks[] = [
  [],
  [{ type: "bold" }],
  [{ type: "code" }],
  [{ attrs: { href: "https://example.com/x?a=1&b=2" }, type: "link" }],
];

/** Every block the writer can write, around one piece of words. */
const BLOCKS: readonly {
  build: (words: JSONContent) => JSONContent[];
  name: string;
}[] = [
  { build: (words) => [paragraph(words)], name: "paragraph" },
  {
    build: (words) => [paragraph(words), paragraph(text("second"))],
    name: "two paragraphs",
  },
  {
    build: (words) => [
      paragraph(words),
      { type: "paragraph" },
      { type: "paragraph" },
      paragraph(text("after the blank lines")),
    ],
    name: "blank lines",
  },
  {
    build: (words) => [
      { attrs: { level: 2 }, content: [words], type: "heading" },
    ],
    name: "heading",
  },
  {
    build: (words) => [
      {
        content: [item(words), item(text("two"))],
        type: "bulletList",
      },
    ],
    name: "bullets",
  },
  {
    build: (words) => [
      {
        attrs: { start: 1 },
        content: [item(words), item(text("two"))],
        type: "orderedList",
      },
    ],
    name: "numbers",
  },
  {
    build: (words) => [
      {
        content: [
          {
            attrs: { checked: false },
            content: [paragraph(words)],
            type: "taskItem",
          },
          {
            attrs: { checked: true },
            content: [paragraph(text("done"))],
            type: "taskItem",
          },
        ],
        type: "taskList",
      },
    ],
    name: "tasks",
  },
  {
    build: (words) => [
      {
        content: [
          item(text("top"), {
            content: [item(words)],
            type: "bulletList",
          }),
        ],
        type: "bulletList",
      },
    ],
    name: "a list in a list",
  },
  {
    build: (words) => [{ content: [paragraph(words)], type: "blockquote" }],
    name: "quote",
  },
  {
    build: (words) => [paragraph(words), { type: "horizontalRule" }],
    name: "divider",
  },
  {
    build: (words) => [
      paragraph(words, { type: "hardBreak" }, text("next line")),
    ],
    name: "line break",
  },
];

describe("plainText", () => {
  describe("against the editor", () => {
    it("says what the editor shows for each text a learner may type", () => {
      for (const words of WORST) {
        const stored = writtenBy(doc(paragraph(text(words))));

        // No edit of the text is lost by writing it and opening it again.
        expect(shownBy(stored)).toBe(collapse(words));
        expect(plainText(stored)).toBe(collapse(words));
      }
    });

    it("says what the editor shows for every block the writer can write, with or without a mark", () => {
      const differing = Arr.flatMap(BLOCKS, ({ build, name }) =>
        Arr.flatMap(WORST, (words) =>
          Arr.flatMap(MARKS, (marks) => {
            const stored = writtenBy(doc(...build(text(words, marks))));

            return plainText(stored) === shownBy(stored)
              ? []
              : [`${name} of "${words}" stored as "${stored}"`];
          })
        )
      );

      expect(differing).toEqual([]);
    });

    it("says what the editor shows for a heading, a code block and a quote of several paragraphs", () => {
      const stored = writtenBy(
        doc(
          { attrs: { level: 1 }, content: [text("Plan")], type: "heading" },
          {
            attrs: { language: "ts" },
            content: [text("const a = 1 < 2 && 3 > 2 // ** __ ``")],
            type: "codeBlock",
          },
          {
            content: [paragraph(text("first")), paragraph(text("second"))],
            type: "blockquote",
          }
        )
      );

      expect(stored).toBe(
        "# Plan\n\n```ts\nconst a = 1 < 2 && 3 > 2 // ** __ ``\n```\n\n> first\n>\n> second"
      );
      expect(plainText(stored)).toBe(shownBy(stored));
      expect(plainText(stored)).toBe(
        "Plan const a = 1 < 2 && 3 > 2 // ** __ `` first second"
      );
    });

    it("says what the editor shows for Markdown the editor never wrote, as Nina or another client may", () => {
      const markdowns = [
        "Plain *words*, **bold**, _under_ and ~~struck~~",
        "[a **link**](https://example.com/a?x=1&amp;y=2) and <https://auto.example.com>",
        "![the alt text](picture.png) after",
        "line one\nline two",
        "line one  \nline two",
        "x\\\ny",
        "Title\n=====\nbody",
        "text\n---\nmore",
        "    indented code\n    more",
        "# \n\n#hash",
        "> - quoted list\n> - two",
        "- one\n\n- two\n\n  paragraph in two",
        "* star\n* list\n\n+ plus\n+ list",
        "1) one\n2) two",
        "a\n\n\n&nbsp;\n\nb",
        " ",
        "**",
        "[]()",
        "&;",
        "&#38;amp; stays as typed",
        "I like ==highlight== and ++under++ here",
        "if a == b and c == d",
        "I use C++ and C++20",
      ];
      const differing = Arr.filter(
        markdowns,
        (markdown) => plainText(markdown) !== shownBy(markdown)
      );

      expect(differing).toEqual([]);
    });

    it("says what the editor shows even where the editor changes what was typed", () => {
      // The writer escapes neither a plus sign nor an equals sign, so the
      // editor reads a second pair of them in the text as a mark. The words it
      // shows are the words the list must show.
      expect(plainText("I use C++ and C++20")).toBe("I use Cand C20");
      expect(shownBy("I use C++ and C++20")).toBe("I use Cand C20");
      expect(plainText("if a == b and c == d")).toBe("if a b and c d");
      expect(shownBy("if a == b and c == d")).toBe("if a b and c d");
    });

    it("reads the references the writer puts in text as the editor does, and no others", () => {
      const references = [
        "&amp;",
        "&lt;b&gt;",
        "&quot;",
        "&#38;",
        "&#x26;",
        "&#X26;",
        "&#128; &#150; &#159;",
        "&#0; &#xD800; &#1114112; &#xFFFFFF;",
        "&#12345678; &#xFFFFFFF;",
        "&copy; &nbsp;x &Amp; &AMP;",
        "&amp;lt; and &#38;amp;",
        "a & b; &",
      ];

      expect(
        Arr.filter(
          references,
          (reference) =>
            plainText(reference) !== collapse(decodeHtmlEntities(reference))
        )
      ).toEqual([]);
    });
  });

  describe("on its own", () => {
    it("reads one line of words from Markdown", () => {
      expect(plainText("Kelas **12** IPA, ikut *SNBT* 2027")).toBe(
        "Kelas 12 IPA, ikut SNBT 2027"
      );
      expect(plainText("- Limit\n- Turunan\n\n1. Integral")).toBe(
        "Limit Turunan Integral"
      );
      expect(
        plainText(
          "# Plan\n\n- [ ] Read ++chapter 3++\n- [x] ==Limits== done\n\n> Ask about [the syllabus](https://example.com/s)\n\n---\n\n```ts\nconst x = 1\n```"
        )
      ).toBe(
        "Plan Read chapter 3 Limits done Ask about the syllabus const x = 1"
      );
    });

    it("keeps a plus sign, an equals sign, an ampersand and an angle bracket that are only words", () => {
      expect(plainText("I study C++ at university")).toBe(
        "I study C++ at university"
      );
      expect(plainText("a == b")).toBe("a == b");
      expect(plainText("Q&amp;A")).toBe("Q&A");
      expect(plainText("a &lt; b &gt; c")).toBe("a < b > c");
      expect(plainText("==")).toBe("==");
      expect(plainText("++")).toBe("++");
    });

    it("reads a mark only as a pair around words", () => {
      expect(plainText("a ==b== c ++d++ e")).toBe("a b c d e");
      expect(plainText("a == b == c")).toBe("a b c");
      expect(plainText("a ++ b")).toBe("a ++ b");
      expect(plainText("a =b= c")).toBe("a =b= c");
    });

    it("drops the writer's escapes and reads a code span as it is", () => {
      expect(
        plainText("Nilai 9\\.5 dan 2 \\* 3 and \\*\\*not bold\\*\\*")
      ).toBe("Nilai 9.5 dan 2 * 3 and **not bold**");
      expect(plainText("`code &amp; more` and \\` alone")).toBe(
        "code &amp; more and ` alone"
      );
    });

    it("keeps a link's words and drops its address", () => {
      expect(
        plainText(
          "[https://example.com/a?x=1&amp;y=2](https://example.com/a?x=1&y=2)"
        )
      ).toBe("https://example.com/a?x=1&y=2");
    });

    it("reads a line break and a blank line as a space", () => {
      expect(plainText("one  \ntwo\nthree\n\nfour")).toBe("one two three four");
    });

    it("reads nothing for a divider, a table, a reference and a paragraph that holds only the empty marker", () => {
      expect(plainText("---")).toBe("");
      expect(plainText("a\n\n&nbsp;\n\nb")).toBe("a b");
      expect(plainText(" ")).toBe("");
      expect(plainText("[ref]: https://example.com\n\ntext")).toBe("text");
      expect(plainText("")).toBe("");
    });

    it("shows a stray non-breaking space and an entity beside words as they are", () => {
      expect(plainText("a &nbsp; b")).toBe("a &nbsp; b");
      expect(plainText("a b")).toBe("a b");
    });

    it("keeps raw HTML as text, which is how the editor reads it where no browser can parse it", () => {
      expect(plainText("a <b>c</b> d")).toBe("a <b>c</b> d");
      expect(shownBy("a <b>c</b> d")).toBe("a <b>c</b> d");
    });
  });

  describe("where it still differs from the editor", () => {
    // Each test names a text the editor reads another way than its lexer does.
    // The editor lexes an ordered list with its own tokenizer, which takes a
    // letter or a roman numeral as a marker and keeps a block marker after a
    // number as words. `plainText` lexes with the lexer alone.
    it("shows a letter or a roman numeral with its dot, where the editor shows a list", () => {
      expect(plainText("a. letter list\nb. second")).toBe(
        "a. letter list b. second"
      );
      expect(shownBy("a. letter list\nb. second")).toBe("letter list second");
      expect(plainText("i. roman\nii. two")).toBe("i. roman ii. two");
      expect(shownBy("i. roman\nii. two")).toBe("roman two");
    });

    it("drops a block marker after a number, where the editor keeps it as words", () => {
      expect(plainText("1. # not a heading\n2. two")).toBe("not a heading two");
      expect(shownBy("1. # not a heading\n2. two")).toBe("# not a heading two");
    });

    it("reads nothing for a table, where the editor shows the table as one line of words when nothing else is written", () => {
      expect(plainText("| a | b |\n|---|---|\n| 1 | 2 |")).toBe("");
    });
  });
});

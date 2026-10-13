// @vitest-environment jsdom

import { afterAll, describe, expect, it } from "@effect/vitest";
import { richOptions } from "@repo/design-system/components/editor/extensions";
import { plainText } from "@repo/design-system/components/editor/plain";
import { Editor, type JSONContent } from "@tiptap/core";
import { Array as Arr, Function as Fn, Result, String as Str } from "effect";

/**
 * The editor of a memory with a document to parse HTML in, as a browser has: it
 * reads and writes Markdown exactly as the editor of the Memory page does, and
 * shows its words as `getText` gives them. These tests set that editor against
 * `plainText`.
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

/**
 * One editor serves the hundreds of texts these tests set against the reader:
 * each text replaces the one before it, and an editor made for each text takes
 * longer than a test may.
 */
const editor = openEditor("");

afterAll(() => editor.destroy());

/** Every run of space as one space, and none at either end. */
function collapse(words: string) {
  return Str.trim(Str.replaceAll(/\s+/g, " ")(words));
}

/** The words the editor shows when it opens the stored Markdown. */
function shownBy(markdown: string) {
  editor.commands.setContent(markdown, { contentType: "markdown" });
  return collapse(editor.getText({ blockSeparator: " " }));
}

/**
 * The words an editor shows when the page opens it on the stored Markdown: with
 * the Markdown as its first content, which is not the same as setting it later
 * when the Markdown holds no block the editor can hold.
 */
function openedWith(markdown: string) {
  const opened = openEditor(markdown);
  const words = collapse(opened.getText({ blockSeparator: " " }));

  opened.destroy();
  return words;
}

/** The Markdown the page stores for a document: what the editor writes, without the space around it. */
function writtenBy(doc: JSONContent) {
  editor.commands.setContent(doc);
  return Str.trim(editor.getMarkdown());
}

/** The texts, among these, whose words the reader and the editor say differently. */
function disagreeing(markdowns: readonly string[]) {
  return Arr.filterMap(markdowns, (markdown) => {
    const reader = plainText(markdown);
    const shown = shownBy(markdown);

    return reader === shown
      ? Result.failVoid
      : Result.succeed({ editor: shown, markdown, reader });
  });
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

const bullets = (...items: JSONContent[]): JSONContent => ({
  content: items,
  type: "bulletList",
});

const numbers = (start: number, ...items: JSONContent[]): JSONContent => ({
  attrs: { start },
  content: items,
  type: "orderedList",
});

const task = (checked: boolean, words: JSONContent): JSONContent => ({
  attrs: { checked },
  content: [paragraph(words)],
  type: "taskItem",
});

/** What the learner may type that a Markdown writer must treat with care. */
const WORST = [
  "I study C++ at university",
  "I use C++ and C++20",
  "a == b",
  "if a == b and c == d",
  "a ++ b ++ c",
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
  // Words that start like the items of a list: a title, an abbreviation, a
  // number written out, a letter or a roman numeral with its dot.
  "Dr. Budi sakit",
  "ok. saya",
  "mild. calm",
  "Jl. Merdeka 5",
  "No. 5 is mine",
  "a) first",
  "I. Roman",
  "x. y",
];

/** The marks the writer wraps around words, and a link whose address holds an ampersand. */
const MARKS: readonly Marks[] = [
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
    build: (words) => [bullets(item(words), item(text("two")))],
    name: "bullets",
  },
  {
    build: (words) => [numbers(1, item(words), item(text("two")))],
    name: "numbers",
  },
  {
    build: (words) => [
      numbers(7, item(text("first"), numbers(1, item(words))), item(text("2"))),
    ],
    name: "numbers from seven with a list inside an item",
  },
  {
    build: (words) => [
      {
        content: [task(false, words), task(true, text("done"))],
        type: "taskList",
      },
    ],
    name: "tasks",
  },
  {
    build: (words) => [bullets(item(text("top"), bullets(item(words))))],
    name: "a list in a list",
  },
  {
    build: (words) => [bullets(item(text("top"), numbers(1, item(words))))],
    name: "numbers in a bullet",
  },
  {
    build: (words) => [
      {
        content: [paragraph(words), paragraph(text("second"))],
        type: "blockquote",
      },
    ],
    name: "quote of two paragraphs",
  },
  {
    build: (words) => [
      { attrs: { language: "ts" }, content: [words], type: "codeBlock" },
    ],
    name: "code block",
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
    it("says what the editor shows for each text a learner may type, and loses no word of it", () => {
      for (const words of WORST) {
        const stored = writtenBy(doc(paragraph(text(words))));

        // No edit of the text is lost by writing it and opening it again.
        expect(shownBy(stored)).toBe(collapse(words));
        expect(plainText(stored)).toBe(collapse(words));
      }
    });

    it("says what the editor shows for every block the writer can write", () => {
      const differing = Arr.flatMap(BLOCKS, ({ build, name }) =>
        Arr.flatMap(WORST, (words) => {
          const stored = writtenBy(doc(...build(text(words))));

          return plainText(stored) === shownBy(stored)
            ? []
            : [`${name} of "${words}" stored as "${stored}"`];
        })
      );

      expect(differing).toEqual([]);
    });

    it("says what the editor shows for every mark the writer can write", () => {
      const differing = Arr.flatMap(MARKS, (marks) =>
        Arr.flatMap(WORST, (words) => {
          const stored = writtenBy(doc(paragraph(text(words, marks))));

          return plainText(stored) === shownBy(stored)
            ? []
            : [`${marks[0]?.type} of "${words}" stored as "${stored}"`];
        })
      );

      expect(differing).toEqual([]);
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
        "3. three\n4. four\n   1. inside",
        "a\n\n\n&nbsp;\n\nb",
        " ",
        "**",
        "[]()",
        "&;",
        "&#38;amp; stays as typed",
        "I like ==highlight== and ++under++ here",
        "==highlight== and ++under++",
        "Dr. Budi sakit\nMr. Lee mengajar",
        "a. letter list\nb. second",
        "i. roman\nii. two",
        "1. one\nDr. Budi sakit\n2. two",
        "1. # not a heading\n2. two",
        "1. - not a bullet\n2. - nor this",
        "1. **bold** and ++under++\n2. [link](https://example.com)",
        "1. [ ] **buy** milk\n2. [x] ++done++",
        "- 1. a number inside a bullet\n- 2. and another",
        "[ref]: https://example.com\n\ntext",
        "a\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nb",
        "| a | b |\n|---|---|\n| 1 | 2 |\n\nafter the table",
        "0. zero\n1. one",
        "10. ten\n11. eleven",
      ];

      expect(disagreeing(markdowns)).toEqual([]);
    });

    it("says what the editor shows for each way a line can start and what can follow it", () => {
      const starts = [
        "",
        "# ",
        "## ",
        "> ",
        "- ",
        "* ",
        "+ ",
        "1. ",
        "1) ",
        "10. ",
        "a. ",
        "b) ",
        "ii. ",
        "Dr. ",
        "- [ ] ",
        "- [x] ",
        "1. [ ] ",
        "- 1. ",
        "1. - ",
        "1. # ",
        "> - ",
        "> 1. ",
        "    ",
        "  - ",
        "   1. ",
        "```\n",
        "---\n",
        "***\n",
        "![",
        "\\",
      ];
      const follows = [
        "",
        "\nline",
        "\n\nline",
        "\n  line",
        "\n- line",
        "\n1. line",
        "\na. line",
        "\n# line",
        "\n> line",
      ];
      const markdowns = Arr.flatMap(starts, (start) =>
        Arr.map(follows, (follow) => `${start}word two${follow}`)
      );

      expect(disagreeing(markdowns)).toEqual([]);
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

    it("keeps a plus sign, an equals sign, an ampersand and an angle bracket that are only words, and reads a mark only as a pair around words", () => {
      expect(plainText("I study C++ at university")).toBe(
        "I study C++ at university"
      );
      expect(plainText("Q&amp;A")).toBe("Q&A");
      expect(plainText("a &lt; b &gt; c")).toBe("a < b > c");
      expect(plainText("== and ++")).toBe("== and ++");
      expect(plainText("a ==b== c ++d++ e")).toBe("a b c d e");
      expect(plainText("a == b == c")).toBe("a == b == c");
      expect(plainText("I use C++ and C++20")).toBe("I use C++ and C++20");
    });

    it("keeps the first word of a line that starts like the item of a list", () => {
      expect(
        plainText("Dr. Budi sakit\nok. saya\na. letter list\nb. second")
      ).toBe("Dr. Budi sakit ok. saya a. letter list b. second");
    });

    it("keeps the number of a numbered list inside a bullet, as the editor does", () => {
      expect(plainText("- 1. word")).toBe("1. word");
      expect(plainText("- 1. a ++mark++ here\n- 2. and **more**")).toBe(
        "1. a mark here 2. and more"
      );
    });

    it("drops the writer's escapes, reads a code span as it is, and keeps a link's words without its address", () => {
      expect(
        plainText("Nilai 9\\.5 dan 2 \\* 3 and \\*\\*not bold\\*\\*")
      ).toBe("Nilai 9.5 dan 2 * 3 and **not bold**");
      expect(plainText("`code &amp; more` and \\` alone")).toBe(
        "code &amp; more and ` alone"
      );
      expect(
        plainText(
          "[https://example.com/a?x=1&amp;y=2](https://example.com/a?x=1&y=2)"
        )
      ).toBe("https://example.com/a?x=1&y=2");
    });

    it("reads a line break and a blank line as a space, and a stray non-breaking space as it is", () => {
      expect(plainText("one  \ntwo\nthree\n\nfour")).toBe("one two three four");
      expect(plainText("a &nbsp; b")).toBe("a &nbsp; b");
      expect(plainText("a b")).toBe("a b");
    });

    it("reads nothing for a divider, a table, a reference or a paragraph that holds only the empty marker, so such a memory is called Untitled", () => {
      expect(plainText("---")).toBe("");
      expect(plainText("a\n\n&nbsp;\n\nb")).toBe("a b");
      expect(plainText(" ")).toBe("");
      expect(plainText("[ref]: https://example.com\n\ntext")).toBe("text");
      expect(plainText("")).toBe("");
      expect(plainText("a\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nb")).toBe(
        "a b"
      );
    });
  });

  // The editor never writes raw HTML or a table: it escapes `<` and `>` in what
  // a learner types, and it has no table. Another writer, such as a chat, may.
  // The shapes are ones Tiptap bends to its schema or to its own task list.
  describe("where the editor reads Markdown another way", () => {
    it("reads the tags of raw HTML as text, where the editor drops the tags it has a mark for", () => {
      // The editor parses HTML with the document of the page, which the reader
      // has none of, and the tags it knows are a list of the schema.
      expect(plainText("a <b>c</b> d")).toBe("a <b>c</b> d");
      expect(openedWith("a <b>c</b> d")).toBe("a c d");
    });

    it("reads the shapes that Tiptap bends to its schema or to its own task list as Markdown reads them", () => {
      const shapes = [
        ["- [ ] a\n- [ ] \n- [ ] c", "a [ ] c", "a c"],
        ["- [ ] a\n  ---\n- [ ] b", "[ ] a b", "a b"],
        ["- # head\n\n  text", "head text", "headtext"],
        ["-\n\n  ```ts\n  code\n  ```", "code", ""],
        ["text\n\n   ```\n   code\n   ```", "text code", "text"],
        ["`- [ ] x`", "- [ ] x", "` x`"],
      ] as const;

      expect(
        Arr.map(shapes, ([markdown]) => [
          plainText(markdown),
          shownBy(markdown),
        ])
      ).toEqual(Arr.map(shapes, ([, reader, editor]) => [reader, editor]));
    });

    it("reads nothing for a table alone, where the editor shows the Markdown as it was written", () => {
      // When the lexer finds no block the editor can hold, Tiptap keeps the
      // Markdown as the text of the editor and parses it as HTML.
      const table = "| a | b |\n|---|---|\n| 1 | 2 |";

      expect(plainText(table)).toBe("");
      expect(openedWith(table)).toBe("| a | b | |---|---| | 1 | 2 |");
    });
  });
});

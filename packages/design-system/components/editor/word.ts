import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Array as Arr, Option, String as Str } from "effect";

/** What names a paragraph as an item of a Word list: its level and its list, as `mso-list:l0 level2 lfo1`. */
const WORD_ITEM = /mso-list:\s*l\d+\s+level(\d+)\s+lfo(\d+)/u;

/** A marker that counts, such as `1.`, `a)` or `(iv)`. Every other marker is a bullet. */
const COUNTED_MARKER = /^\(?[\da-z]+[.)]/iu;

/** The conditional comment that opens the marker Word draws for a browser without its list styles. */
const MARKER_OPENS = "[if !supportLists]";

/** The conditional comment that closes that marker. */
const MARKER_CLOSES = "[endif]";

/** One item of a Word list, as the paragraph that holds it. */
interface WordItem {
  readonly counted: boolean;
  readonly element: HTMLElement;
  readonly level: number;
  readonly list: string;
}

/** An item with the items nested under it. */
interface WordBranch {
  readonly item: WordItem;
  readonly nested: readonly WordItem[];
}

/** Whether a node is the conditional comment with these words. */
const isComment = (words: string) => (node: Node) =>
  node.nodeType === Node.COMMENT_NODE && node.nodeValue === words;

/**
 * Takes the marker Word draws in front of an item out of the paragraph, and answers its text: what
 * stands between the two conditional comments, or, in a paste without them, the span Word tells a
 * browser to ignore.
 */
const takeMarker = (paragraph: HTMLElement): string => {
  const opened = Arr.dropWhile(
    Arr.fromIterable(paragraph.childNodes),
    (node) => !isComment(MARKER_OPENS)(node)
  );
  const marked = Arr.takeWhile(opened, (node) => !isComment(MARKER_CLOSES)(node));
  const marker = Arr.isReadonlyArrayNonEmpty(opened)
    ? Arr.take(opened, marked.length + 1)
    : Arr.fromIterable(paragraph.querySelectorAll("[style*='mso-list:Ignore']"));
  const text = Arr.join(
    Arr.map(
      Arr.filter(marker, (node) => node.nodeType !== Node.COMMENT_NODE),
      (node) => String(node.textContent)
    ),
    ""
  );
  Arr.forEach(marker, (node) => {
    node.remove();
  });
  return Str.trim(text);
};

/** The item a paragraph stands for, without its marker, or none for a paragraph of no list. */
const itemOf = (paragraph: HTMLElement): Option.Option<WordItem> =>
  Option.map(
    Option.flatMap(
      Option.fromNullishOr(paragraph.getAttribute("style")),
      Str.match(WORD_ITEM)
    ),
    ([, level, list]) => ({
      counted: COUNTED_MARKER.test(takeMarker(paragraph)),
      element: paragraph,
      level: Number(level),
      list: String(list),
    })
  );

/** Splits the items into runs: paragraphs that follow each other and belong to one list of Word's. */
const runsOf = (items: readonly WordItem[]) =>
  Arr.reduce(
    items,
    Arr.empty<Arr.NonEmptyReadonlyArray<WordItem>>(),
    (runs, item) =>
      Option.match(Arr.last(runs), {
        onNone: () => [Arr.of(item)],
        onSome: (run) => {
          const previous = Arr.lastNonEmpty(run);
          return previous.list === item.list &&
            previous.element === item.element.previousElementSibling
            ? [...Arr.dropRight(runs, 1), Arr.append(run, item)]
            : [...runs, Arr.of(item)];
        },
      })
  );

/** Groups a run under the items of its first level, so each deeper item nests under the one above it. */
const branchesOf = (run: readonly WordItem[], level: number) =>
  Arr.reduce(run, Arr.empty<WordBranch>(), (branches, item) =>
    Option.match(Arr.last(branches), {
      onNone: () => [{ item, nested: [] }],
      onSome: (last) =>
        item.level > level
          ? [
              ...Arr.dropRight(branches, 1),
              { ...last, nested: [...last.nested, item] },
            ]
          : [...branches, { item, nested: [] }],
    })
  );

/** Builds the list of a run: one item for each paragraph, with the deeper ones as a list inside it. */
const listOf = (
  document: Document,
  run: Arr.NonEmptyReadonlyArray<WordItem>
): HTMLElement => {
  const head = Arr.headNonEmpty(run);
  const list = document.createElement(head.counted ? "ol" : "ul");
  Arr.forEach(branchesOf(run, head.level), ({ item, nested }) => {
    const entry = document.createElement("li");
    const words = document.createElement("p");
    words.append(...Arr.fromIterable(item.element.childNodes));
    entry.append(words);
    if (Arr.isReadonlyArrayNonEmpty(nested)) {
      entry.append(listOf(document, nested));
    }
    list.append(entry);
  });
  return list;
};

/**
 * The HTML of a paste with Word's lists as lists. Word writes each item as a paragraph that names its
 * list in its style and draws its own bullet or number as text, so without this a pasted list is a run
 * of paragraphs that start with `·`. A paste that holds no Word list stays as it is.
 */
export const wordLists = (html: string): string => {
  if (!html.includes("mso-list")) {
    return html;
  }
  const document = new DOMParser().parseFromString(html, "text/html");
  const items = Arr.getSomes(
    Arr.map(
      Arr.fromIterable(document.querySelectorAll<HTMLElement>("p[style]")),
      itemOf
    )
  );
  Arr.forEach(runsOf(items), (run) => {
    Arr.headNonEmpty(run).element.before(listOf(document, run));
    Arr.forEach(run, (item) => {
      item.element.remove();
    });
  });
  return document.body.innerHTML;
};

/** The extension that reads Word's lists as lists when a teacher pastes from Word. */
export const wordPaste = Extension.create({
  name: "wordPaste",
  addProseMirrorPlugins: () => [
    new Plugin({ props: { transformPastedHTML: wordLists } }),
  ],
});

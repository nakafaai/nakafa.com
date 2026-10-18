import { Array as Arr, Option, String as Str } from "effect";
import type { ExtraProps } from "react-markdown";
import type { harden } from "rehype-harden";

/** The tree a rehype plugin is given, as the plugin that hardens a response names it. */
type Tree = Parameters<ReturnType<typeof harden>>[0];

/** One element of that tree, with its name, properties and children. */
type Element = NonNullable<ExtraProps["node"]>;

/** One child of an element. */
type Node = Element["children"][number];

/** The elements whose text is written exactly as it stands: code and the math that rides in it. */
const VERBATIM = ["code", "pre"];

/** The elements that stand as blocks: the white space beside them is layout, not a line the learner wrote. */
const BLOCKS = [
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

/** The delimiter of each emphasis, by the element it becomes. */
const DELIMITERS: Readonly<Record<string, string>> = {
  em: "*",
  strong: "**",
};

/** A letter or a digit in any script. */
const WORD_CHARACTER = /^[\p{L}\p{N}]$/u;

/** A soft line break, with the spaces CommonMark drops around it. */
const LINE_BREAK = / *\n */u;

/** The text a node draws, its own or that of every text below it. */
function textOf(node: Node | undefined): string {
  if (node === undefined) {
    return "";
  }
  if (node.type === "text") {
    return node.value;
  }
  if (node.type !== "element") {
    return "";
  }
  return Arr.join(Arr.map(node.children, textOf), "");
}

/** Whether a string starts, or ends, with a letter or a digit. */
const startsWithWord = (text: string) => WORD_CHARACTER.test(text.charAt(0));
const endsWithWord = (text: string) => WORD_CHARACTER.test(text.at(-1) ?? "");

/**
 * The asterisks of an emphasis that was written inside a word, with a letter or
 * a digit on both sides of its opening or of its closing asterisks, as in
 * `2*3 + 4*5`. A learner who writes a product means the asterisks, not italics.
 * Underscores never open or close inside a word, so only asterisks get here.
 */
function delimiterInsideWords(
  element: Element,
  before: Node | undefined,
  after: Node | undefined
): Option.Option<string> {
  const delimiter = DELIMITERS[element.tagName];
  if (delimiter === undefined) {
    return Option.none();
  }
  const inner = textOf(element);
  const opens = endsWithWord(textOf(before)) && startsWithWord(inner);
  const closes = endsWithWord(inner) && startsWithWord(textOf(after));
  return opens || closes ? Option.some(delimiter) : Option.none();
}

/** The text of a soft-broken run as text and line breaks, each break where the learner pressed Enter. */
function breakLines(value: string): Node[] {
  const lines = Str.split(value, LINE_BREAK);
  return Arr.flatMap(lines, (line, index) => {
    const text: Node = { type: "text", value: line };
    if (index === 0) {
      return [text];
    }
    const lineBreak: Node = {
      children: [],
      properties: {},
      tagName: "br",
      type: "element",
    };
    return [lineBreak, text];
  });
}

/** Whether a node runs inside a line: text, HTML the learner typed, or an element that is not a block. */
function isInline(node: Node | undefined): boolean {
  if (node === undefined) {
    return false;
  }
  if (node.type === "element") {
    return !Arr.contains(BLOCKS, node.tagName);
  }
  return node.type === "text" || node.type === "raw";
}

/**
 * The children of an element as learner text draws them. A line ending with
 * only white space is a line break when it sits between two inline nodes, as
 * between a bold run and a link on the next line, and layout beside a block.
 * HTML the learner typed is drawn as its text, so its lines break there too.
 */
function learnerChildren(children: readonly Node[]): Node[] {
  return Arr.flatMap(children, (child, index): Node[] => {
    if (child.type !== "element") {
      if (!Str.includes("\n")(child.value)) {
        return [child];
      }
      const layout =
        Str.trim(child.value) === "" &&
        !(isInline(children[index - 1]) && isInline(children[index + 1]));
      return layout ? [child] : breakLines(child.value);
    }
    if (Arr.contains(VERBATIM, child.tagName)) {
      return [child];
    }
    child.children = learnerChildren(child.children);
    return Option.match(
      delimiterInsideWords(child, children[index - 1], children[index + 1]),
      {
        onNone: () => [child],
        onSome: (value) => {
          const delimiter: Node = { type: "text", value };
          return [delimiter, ...child.children, delimiter];
        },
      }
    );
  });
}

/**
 * A rehype plugin for text a learner wrote. Each line break inside a paragraph,
 * a list item, a heading, a cell or a line of HTML the learner typed stays a
 * line break, as the learner pressed Enter, and asterisks written inside words stay asterisks, so `2*3 + 4*5`
 * reads as written. Code and math keep their text as it stands.
 */
export function rehypeLearnerText() {
  return (tree: Tree) => {
    tree.children = Arr.flatMap(tree.children, (block): Tree["children"] => {
      if (block.type === "raw") {
        return breakLines(block.value);
      }
      if (block.type === "element" && !Arr.contains(VERBATIM, block.tagName)) {
        block.children = learnerChildren(block.children);
      }
      return [block];
    });
  };
}

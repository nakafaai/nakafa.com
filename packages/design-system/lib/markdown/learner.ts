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

/** The children of an element as learner text draws them. */
function learnerChildren(children: readonly Node[]): Node[] {
  return Arr.flatMap(children, (child, index): Node[] => {
    if (child.type === "text") {
      return Str.trim(child.value) === "" || !Str.includes("\n")(child.value)
        ? [child]
        : breakLines(child.value);
    }
    if (child.type !== "element" || Arr.contains(VERBATIM, child.tagName)) {
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
 * a list item, a heading or a cell stays a line break, as the learner pressed
 * Enter, and asterisks written inside words stay asterisks, so `2*3 + 4*5`
 * reads as written. Code and math keep their text as it stands.
 */
export function rehypeLearnerText() {
  return (tree: Tree) => {
    Arr.forEach(tree.children, (block) => {
      if (block.type === "element" && !Arr.contains(VERBATIM, block.tagName)) {
        block.children = learnerChildren(block.children);
      }
    });
  };
}

import { Array as Arr } from "effect";
import type { ExtraProps } from "react-markdown";
import type { harden } from "rehype-harden";

/** The tree a rehype plugin is given, as the plugin that hardens a response names it. */
type Tree = Parameters<ReturnType<typeof harden>>[0];

/** One element of that tree, with its name, properties and children. */
type Element = NonNullable<ExtraProps["node"]>;

/** The elements that hold one run of text, which reads in the direction of its own text. */
const TEXT_BLOCKS = ["h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "td", "th"];

/**
 * Sets `dir="auto"` on each text block under `parent`.
 *
 * An element reads its direction from its text and passes over any descendant
 * that has a `dir` of its own. A list item whose paragraph carried one would
 * find no text, stay as the page is, and keep the room for its marker on the
 * wrong side. The paragraph of an item therefore leaves the direction to its
 * item, which reads the same text.
 */
function markBlocks(parent: Tree | Element) {
  const inItem = parent.type === "element" && parent.tagName === "li";

  Arr.forEach(parent.children, (child) => {
    if (child.type !== "element") {
      return;
    }
    if (
      Arr.contains(TEXT_BLOCKS, child.tagName) &&
      !(inItem && child.tagName === "p")
    ) {
      child.properties.dir = "auto";
    }
    markBlocks(child);
  });
}

/**
 * A rehype plugin that lets each heading, paragraph, list item and table cell
 * of a Markdown response take the direction of its own text. An Arabic block
 * starts at its own side, with its punctuation and its list marker on the
 * right sides, in an answer that mixes scripts as much as in one that is
 * wholly Arabic.
 */
export function rehypeDirection() {
  return (tree: Tree) => {
    markBlocks(tree);
  };
}

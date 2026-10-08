import type { ExtraProps, Options } from "react-markdown";

export type ReactMarkdownComponents = NonNullable<Options["components"]>;

type MarkdownNode = NonNullable<ExtraProps["node"]>;
type MarkdownChildNode = MarkdownNode["children"][number];

/** Narrows one markdown child to a node that owns nested children. */
function hasMarkdownChildren(node: MarkdownChildNode): node is MarkdownNode {
  return "children" in node;
}

/** Extracts rendered text from the markdown AST instead of React children. */
export function readMarkdownNodeText(
  node?: MarkdownChildNode | MarkdownNode
): string {
  if (!node) {
    return "";
  }
  if (node.type === "text") {
    return node.value;
  }
  if (!(hasMarkdownChildren(node) && node.children.length)) {
    return "";
  }

  return node.children.map(readMarkdownNodeText).join("");
}

import type { ExtraProps, Options } from "react-markdown";

export type ReactMarkdownComponents = NonNullable<Options["components"]>;

type MarkdownNode = NonNullable<ExtraProps["node"]>;
type MarkdownChildNode = MarkdownNode["children"][number];
type MarkdownTextNode = Extract<MarkdownChildNode, { type: "text" }>;
type MarkdownNodePosition = Pick<MarkdownNode, "position">;

/** Compares only stable source coordinates from two rendered markdown nodes. */
function sameNodePosition(
  previous?: MarkdownNodePosition,
  next?: MarkdownNodePosition
): boolean {
  if (!(previous?.position || next?.position)) {
    return true;
  }
  if (!(previous?.position && next?.position)) {
    return false;
  }

  const previousStart = previous.position.start;
  const nextStart = next.position.start;
  const previousEnd = previous.position.end;
  const nextEnd = next.position.end;

  return (
    previousStart?.line === nextStart?.line &&
    previousStart?.column === nextStart?.column &&
    previousEnd?.line === nextEnd?.line &&
    previousEnd?.column === nextEnd?.column
  );
}

/** Reuses markdown elements when their class and source coordinates match. */
export function sameClassAndNode(
  previous: { className?: string; node?: MarkdownNode },
  next: { className?: string; node?: MarkdownNode }
) {
  return (
    previous.className === next.className &&
    sameNodePosition(previous.node, next.node)
  );
}

/** Narrows one markdown child to its source text representation. */
function isMarkdownTextNode(node: MarkdownChildNode): node is MarkdownTextNode {
  return node.type === "text";
}

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
  if (isMarkdownTextNode(node)) {
    return node.value;
  }
  if (!(hasMarkdownChildren(node) && node.children.length)) {
    return "";
  }

  return node.children.map(readMarkdownNodeText).join("");
}

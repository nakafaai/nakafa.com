import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Order, Result } from "effect";
import type { Nodes, Root } from "mdast";

/** A site path: it starts with one "/". Two name another host, not a path. */
const SITE_PATH_PATTERN = /^\/(?!\/)/u;

/** Returns a node and every node below it, in document order. */
function nodesBelow(node: Nodes): readonly Nodes[] {
  return "children" in node
    ? Arr.prepend(Arr.flatMap(node.children, nodesBelow), node)
    : [node];
}

/**
 * Returns where the target of a link, an image, or a definition starts in the
 * source, when that target is a site path. The target follows the last `](` of
 * a link or an image, because the text of a link may hold an image with its
 * own target, and it follows the `]:` of a definition.
 */
function sitePathOffset(node: Nodes, source: string) {
  if (
    (node.type !== "link" &&
      node.type !== "image" &&
      node.type !== "definition") ||
    node.position?.start.offset === undefined ||
    node.position.end.offset === undefined ||
    !SITE_PATH_PATTERN.test(node.url)
  ) {
    return Result.failVoid;
  }
  const start = node.position.start.offset;
  const text = source.slice(start, node.position.end.offset);
  const marker =
    node.type === "definition" ? text.indexOf("]:") : text.lastIndexOf("](");
  const target = text.indexOf(node.url, marker);
  return target < 0 ? Result.failVoid : Result.succeed(start + target);
}

/**
 * Writes every site path that a Markdown link, image, or definition of an MDX
 * source points to as an absolute Nakafa URL. An agent reads the Markdown away
 * from the site, where a path that starts at the root has no base to resolve
 * against. A target inside a JSX attribute or inside code is left as written.
 */
export function absoluteSiteLinks(source: string, tree: Root) {
  return Arr.reduce(
    Arr.sort(
      Arr.filterMap(nodesBelow(tree), (node) => sitePathOffset(node, source)),
      Order.flip(Order.Number)
    ),
    source,
    (text, offset) => text.slice(0, offset) + SITE_ORIGIN + text.slice(offset)
  );
}

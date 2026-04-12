import { createHeadingId } from "@repo/design-system/lib/utils";
import { remark } from "remark";
import remarkMdx from "remark-mdx";

const WORD_SEPARATOR = /\s+/;
const mdxParser = remark().use(remarkMdx);

/**
 * Converts MDX source into semantic HTML while preserving markdown headings.
 *
 * References:
 * - remark parser:
 *   https://github.com/remarkjs/remark/tree/main/packages/remark
 * - remark-mdx parser extension:
 *   https://mdxjs.com/packages/remark-mdx/
 */
export function renderMdxHtml(source: string) {
  const root = readRecord(mdxParser.parse(source));

  if (!root) {
    return "";
  }

  if (!Array.isArray(root.children)) {
    return "";
  }

  return root.children.map(renderBlockNode).join("");
}

/**
 * Extracts plain searchable text from markdown or MDX source.
 */
export function extractMdxText(source: string) {
  return normalizeText(readNode(mdxParser.parse(source)));
}

/**
 * Normalizes arbitrary text into a compact Pagefind body string.
 */
export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Counts words using the same whitespace normalization as the index corpus.
 */
export function countWords(value: string) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(WORD_SEPARATOR).length : 0;
}

/**
 * Escapes arbitrary text for safe inclusion in synthetic HTML records.
 */
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Serializes block-level markdown / MDX nodes into simplified semantic HTML.
 */
function renderBlockNode(node: unknown): string {
  const current = readRecord(node);

  if (!current) {
    return "";
  }

  if (!("type" in current)) {
    return "";
  }

  if (
    current.type === "mdxjsEsm" ||
    current.type === "mdxFlowExpression" ||
    current.type === "mdxTextExpression"
  ) {
    return "";
  }

  if (current.type === "heading" && typeof current.depth === "number") {
    const text = normalizeText(readNode(current));

    if (!text) {
      return "";
    }

    const level = Math.min(Math.max(current.depth, 2), 6);
    const id = createHeadingId(text);

    return `<h${level} id="${id}">${escapeHtml(text)}</h${level}>`;
  }

  if (current.type === "paragraph") {
    const html = renderInlineNodes(current.children);
    return html ? `<p>${html}</p>` : "";
  }

  if (current.type === "list") {
    const tag = current.ordered ? "ol" : "ul";
    const items = Array.isArray(current.children)
      ? current.children.map(renderBlockNode).join("")
      : "";

    return items ? `<${tag}>${items}</${tag}>` : "";
  }

  if (current.type === "listItem") {
    const html = Array.isArray(current.children)
      ? current.children.map(renderBlockNode).join("")
      : "";

    return html ? `<li>${html}</li>` : "";
  }

  if (current.type === "code" && typeof current.value === "string") {
    return `<pre><code>${escapeHtml(current.value)}</code></pre>`;
  }

  if (current.type === "blockquote") {
    const html = Array.isArray(current.children)
      ? current.children.map(renderBlockNode).join("")
      : "";

    return html ? `<blockquote>${html}</blockquote>` : "";
  }

  if (current.type === "thematicBreak") {
    return "<hr />";
  }

  const text = normalizeText(readNode(current));
  return text ? `<p>${escapeHtml(text)}</p>` : "";
}

/**
 * Serializes inline markdown nodes into HTML while preserving visible text.
 */
function renderInlineNodes(nodes: unknown) {
  if (!Array.isArray(nodes)) {
    return "";
  }

  return nodes.map(renderInlineNode).join("");
}

/**
 * Serializes one inline markdown or MDX node into simplified semantic HTML.
 */
function renderInlineNode(node: unknown): string {
  const current = readRecord(node);

  if (!current) {
    return "";
  }

  if (!("type" in current)) {
    return "";
  }

  if (current.type === "text" && typeof current.value === "string") {
    return escapeHtml(current.value);
  }

  if (current.type === "inlineCode" && typeof current.value === "string") {
    return `<code>${escapeHtml(current.value)}</code>`;
  }

  if (current.type === "strong") {
    return `<strong>${renderInlineNodes(current.children)}</strong>`;
  }

  if (current.type === "emphasis") {
    return `<em>${renderInlineNodes(current.children)}</em>`;
  }

  if (current.type === "delete") {
    return `<s>${renderInlineNodes(current.children)}</s>`;
  }

  if (current.type === "link") {
    const html = renderInlineNodes(current.children);

    if (html) {
      return html;
    }

    if (typeof current.url === "string") {
      return escapeHtml(current.url);
    }

    return "";
  }

  if (current.type === "break") {
    return "<br />";
  }

  return escapeHtml(normalizeText(readNode(current)));
}

/**
 * Reads text content from a markdown or MDX AST node.
 *
 * We intentionally skip MDX ESM / expression nodes so imports, metadata exports,
 * and JSX expressions don't leak into search records.
 */
function readNode(node: unknown): string {
  const current = readRecord(node);

  if (!current) {
    return "";
  }

  if ("type" in current) {
    if (
      current.type === "mdxjsEsm" ||
      current.type === "mdxFlowExpression" ||
      current.type === "mdxTextExpression"
    ) {
      return "";
    }

    if ("value" in current && typeof current.value === "string") {
      return current.value;
    }

    if ("alt" in current && typeof current.alt === "string") {
      return current.alt;
    }
  }

  const values = [
    ...(Array.isArray(current.attributes)
      ? current.attributes
          .map(readRecord)
          .filter((attribute) => attribute !== null)
          .flatMap((attribute) =>
            "value" in attribute && typeof attribute.value === "string"
              ? [attribute.value]
              : []
          )
      : []),
    ...(Array.isArray(current.children) ? current.children.map(readNode) : []),
  ];

  return values.join("\n");
}

/**
 * Narrows an unknown value to a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/**
 * Returns a record value when the input is an object.
 */
function readRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return value;
}

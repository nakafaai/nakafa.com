import { formatCodeBlockData } from "@repo/contents/_types/llms/code";
import { preprocessLaTeX } from "@repo/design-system/lib/parse-math";
import { Effect, Schema } from "effect";
import type { Parent, Root, RootContent } from "mdast";
import type {
  MdxJsxAttribute,
  MdxJsxExpressionAttribute,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { type Processor, unified } from "unified";

const PROCESSOR = configureMdxProcessor(unified().use(remarkParse));
const COMPONENT_PROP_LIMIT = 1200;
const COMPONENT_CHILD_LIMIT = 2200;
const OPEN_FRAGMENT_PATTERN = /^<>\s*/;
const CLOSE_FRAGMENT_PATTERN = /\s*<\/>$/;
const TRAILING_LINE_SPACES_PATTERN = /[ \t]+\n/g;
const LEADING_LINE_SPACES_PATTERN = /\n[ \t]+/g;
const REPEATED_SPACES_PATTERN = /[ \t]{2,}/g;
const EXCESS_BLANK_LINES_PATTERN = /\n{3,}/g;
const FENCED_MATH_BLOCK_PATTERN = /```math[\s\S]*?```/g;
const INLINE_MATH_MARKDOWN_PATTERN = /\$\$[\s\S]*?\$\$/g;
const MdxPositionSchema = Schema.Struct({
  start: Schema.Struct({
    offset: Schema.Number,
  }),
  end: Schema.Struct({
    offset: Schema.Number,
  }),
});

/** Expected failure while parsing authored MDX for agent markdown projection. */
export class MdxAgentProjectionError extends Schema.TaggedError<MdxAgentProjectionError>()(
  "MdxAgentProjectionError",
  {
    message: Schema.String,
  }
) {}

/** Projects authored MDX into bounded markdown that preserves agent semantics. */
export const projectMdxForAgentMarkdown = Effect.fn(
  "contents.llms.mdx.project"
)(function* (body: string) {
  const tree = yield* parseMdxTree(body);
  return yield* Effect.try({
    try: () => cleanAgentMarkdown(renderChildren(tree, body).join("\n\n")),
    catch: makeMdxAgentProjectionError,
  });
});

/** Formats raw authored MDX text when a caller intentionally chooses fallback. */
export function preserveMdxSourceForAgentMarkdown(body: string) {
  return cleanAgentMarkdown(body);
}

/** Parses authored MDX into the root tree shape consumed by the projection renderer. */
function parseMdxTree(body: string) {
  return Effect.try({
    try: () => PROCESSOR.parse(body),
    catch: makeMdxAgentProjectionError,
  });
}

/** Converts parser and renderer defects into the typed projection failure channel. */
function makeMdxAgentProjectionError(cause: unknown) {
  return new MdxAgentProjectionError({
    message: String(cause),
  });
}

/** Renders one MDX AST node into agent-readable markdown. */
function renderNode(node: RootContent, source: string): string {
  if (node.type === "mdxjsEsm") {
    return "";
  }

  if (isMdxElementNode(node)) {
    return renderMdxElement(node, source);
  }

  return appendVisibleTextVariant(
    preprocessLaTeX(readSourceSlice(node, source))
  );
}

/** Renders a parent node by preserving only visible child markdown rows. */
function renderChildren(node: Parent, source: string): string[] {
  return node.children
    .map((child) => renderNode(child, source).trim())
    .filter(Boolean);
}

/** Renders framework MDX elements into a compact markdown representation. */
function renderMdxElement(
  node: MdxJsxFlowElement | MdxJsxTextElement,
  source: string
): string {
  const { name } = node;

  if (!name) {
    return renderChildren(node, source).join("\n\n");
  }

  const { attributes } = node;

  if (name === "InlineMath") {
    return `$$${readAttribute(attributes, "math")}$$`;
  }

  if (name === "BlockMath") {
    return toMathFence(readAttribute(attributes, "math"));
  }

  if (name === "CodeBlock") {
    return formatCodeBlockData(readAttribute(attributes, "data"));
  }

  if (name === "Mermaid") {
    return renderMermaid(attributes, node, source);
  }

  return renderGenericComponent(name, attributes, node, source);
}

/** Renders Mermaid with chart fences while preserving component props when present. */
function renderMermaid(
  attributes: MdxAttribute[],
  node: MdxJsxFlowElement | MdxJsxTextElement,
  source: string
) {
  const chart = cleanTemplateValue(readAttribute(attributes, "chart"));

  if (!chart) {
    return renderGenericComponent("Mermaid", attributes, node, source);
  }

  const rows = renderGenericComponentRows("Mermaid", attributes, node, source, [
    "chart",
  ]);

  rows.push("```mermaid");
  rows.push(chart);
  rows.push("```");

  return rows.join("\n");
}

/** Renders an unknown MDX component as a named component block. */
function renderGenericComponent(
  name: string,
  attributes: MdxAttribute[],
  node: MdxJsxFlowElement | MdxJsxTextElement,
  source: string
) {
  return renderGenericComponentRows(name, attributes, node, source, []).join(
    "\n"
  );
}

/** Builds the rows that describe an MDX component's props and children. */
function renderGenericComponentRows(
  name: string,
  attributes: MdxAttribute[],
  node: MdxJsxFlowElement | MdxJsxTextElement,
  source: string,
  omittedAttributes: string[]
) {
  const rows = [`Component: ${name}`];
  const props = attributes
    .map((attribute) => renderAttribute(attribute, omittedAttributes))
    .filter(Boolean);
  const children = renderChildren(node, source).join("\n\n").trim();

  if (props.length > 0) {
    rows.push("Props:");
    rows.push(...props);
  }

  if (children) {
    rows.push("Children:");
    rows.push(limitText(children, COMPONENT_CHILD_LIMIT));
  }

  return rows;
}

/** Formats one MDX attribute row unless the caller intentionally omits it. */
function renderAttribute(attribute: MdxAttribute, omittedAttributes: string[]) {
  const name = readAttributeName(attribute);

  if (!name || omittedAttributes.includes(name)) {
    return "";
  }

  const value = readAttributeValue(attribute);

  if (!value) {
    return "";
  }

  const formatted = formatAttributeText(value);
  const visibleText = readVisibleText(formatted);

  if (!visibleText || visibleText === formatted) {
    return `- ${name}: ${formatted}`;
  }

  return `- ${name}: ${formatted}\n  Visible text: ${visibleText}`;
}

/** Reads a named MDX attribute as source text. */
function readAttribute(attributes: MdxAttribute[], name: string) {
  for (const attribute of attributes) {
    if (readAttributeName(attribute) === name) {
      return readAttributeValue(attribute);
    }
  }

  return "";
}

/** Returns the source-level attribute name, including spread expressions. */
function readAttributeName(attribute: MdxAttribute) {
  if (isExpressionAttribute(attribute)) {
    return "spread";
  }

  return attribute.name;
}

/** Converts an MDX attribute value into stable source text for agent markdown. */
function readAttributeValue(attribute: MdxAttribute) {
  if (isExpressionAttribute(attribute)) {
    return attribute.value;
  }

  const { value } = attribute;

  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "true";
  }

  return value.value;
}

/** Reads the original source slice for a positioned Markdown node. */
function readSourceSlice(node: RootContent, source: string) {
  const position = Schema.decodeUnknownSync(MdxPositionSchema)(node.position);
  const start = Math.max(0, position.start.offset);
  const end = Math.max(start, position.end.offset);

  return source.slice(start, end).trim();
}

/** Normalizes an attribute's authored text before exposing it to agents. */
function formatAttributeText(value: string) {
  return limitText(
    preprocessLaTeX(cleanTemplateValue(value))
      .replace(OPEN_FRAGMENT_PATTERN, "")
      .replace(CLOSE_FRAGMENT_PATTERN, "")
      .replace(TRAILING_LINE_SPACES_PATTERN, "\n")
      .replace(LEADING_LINE_SPACES_PATTERN, "\n")
      .replace(REPEATED_SPACES_PATTERN, " ")
      .trim(),
    COMPONENT_PROP_LIMIT
  );
}

/** Removes one layer of template literal quoting from authored prop values. */
function cleanTemplateValue(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/** Converts authored math text into the fenced math format used by AFDocs. */
function toMathFence(math: string) {
  if (!math.trim()) {
    return "";
  }

  return `\`\`\`math\n${math.trim()}\n\`\`\``;
}

/** Caps large component prop or child payloads while preserving total size evidence. */
function limitText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trim()} ... [truncated; ${value.length} chars]`;
}

/** Normalizes blank lines and LaTeX before returning final agent markdown. */
function cleanAgentMarkdown(markdown: string) {
  return preprocessLaTeX(markdown)
    .replace(EXCESS_BLANK_LINES_PATTERN, "\n\n")
    .trim();
}

/**
 * Adds the plain text that the rendered page exposes after math DOM is removed.
 *
 * The semantic line keeps LaTeX for agents; the visible line keeps AFDocs
 * parity with human-rendered prose without replacing the source math.
 */
function appendVisibleTextVariant(markdown: string) {
  const visibleText = readVisibleText(markdown);

  if (!visibleText || visibleText === markdown.trim()) {
    return markdown;
  }

  return `${markdown}\n\nVisible text: ${visibleText}`;
}

/** Extracts rendered-visible prose by removing math-only source blocks. */
function readVisibleText(markdown: string) {
  return markdown
    .replace(FENCED_MATH_BLOCK_PATTERN, "")
    .replace(INLINE_MATH_MARKDOWN_PATTERN, "")
    .replace(EXCESS_BLANK_LINES_PATTERN, "\n\n")
    .replace(REPEATED_SPACES_PATTERN, " ")
    .trim();
}

type MdxAttribute = MdxJsxAttribute | MdxJsxExpressionAttribute;

/** Configures MDX JSX parsing on the root Markdown processor. */
function configureMdxProcessor(processor: Processor<Root>) {
  processor.use(remarkMdx);
  return processor;
}

/** Narrows Markdown content to MDX JSX element nodes that carry attributes. */
function isMdxElementNode(
  node: RootContent
): node is MdxJsxFlowElement | MdxJsxTextElement {
  return (
    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
    Array.isArray(node.children) &&
    Array.isArray(node.attributes)
  );
}

/** Narrows an MDX attribute to expression/spread syntax. */
function isExpressionAttribute(
  attribute: MdxAttribute
): attribute is MdxJsxExpressionAttribute {
  return attribute.type === "mdxJsxExpressionAttribute";
}

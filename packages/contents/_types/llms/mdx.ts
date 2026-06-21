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

const PROCESSOR: Processor<Root> = unified().use(remarkParse);
PROCESSOR.use(remarkMdx);
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

function parseMdxTree(body: string) {
  return Effect.try({
    try: () => PROCESSOR.parse(body),
    catch: makeMdxAgentProjectionError,
  });
}

function makeMdxAgentProjectionError(cause: unknown) {
  return new MdxAgentProjectionError({
    message: String(cause),
  });
}

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

function renderChildren(node: Parent, source: string): string[] {
  return node.children
    .map((child) => renderNode(child, source).trim())
    .filter(Boolean);
}

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

function readAttribute(attributes: MdxAttribute[], name: string) {
  for (const attribute of attributes) {
    if (readAttributeName(attribute) === name) {
      return readAttributeValue(attribute);
    }
  }

  return "";
}

function readAttributeName(attribute: MdxAttribute) {
  if (isExpressionAttribute(attribute)) {
    return "spread";
  }

  return attribute.name;
}

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

function readSourceSlice(node: RootContent, source: string) {
  const position = Schema.decodeUnknownSync(MdxPositionSchema)(node.position);
  const start = Math.max(0, position.start.offset);
  const end = Math.max(start, position.end.offset);

  return source.slice(start, end).trim();
}

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

function cleanTemplateValue(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function toMathFence(math: string) {
  if (!math.trim()) {
    return "";
  }

  return `\`\`\`math\n${math.trim()}\n\`\`\``;
}

function limitText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trim()} ... [truncated; ${value.length} chars]`;
}

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

function readVisibleText(markdown: string) {
  return markdown
    .replace(FENCED_MATH_BLOCK_PATTERN, "")
    .replace(INLINE_MATH_MARKDOWN_PATTERN, "")
    .replace(EXCESS_BLANK_LINES_PATTERN, "\n\n")
    .replace(REPEATED_SPACES_PATTERN, " ")
    .trim();
}

type MdxAttribute = MdxJsxAttribute | MdxJsxExpressionAttribute;

function isMdxElementNode(
  node: RootContent
): node is MdxJsxFlowElement | MdxJsxTextElement {
  return (
    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
    Array.isArray(node.children) &&
    Array.isArray(node.attributes)
  );
}

function isExpressionAttribute(
  attribute: MdxAttribute
): attribute is MdxJsxExpressionAttribute {
  return attribute.type === "mdxJsxExpressionAttribute";
}

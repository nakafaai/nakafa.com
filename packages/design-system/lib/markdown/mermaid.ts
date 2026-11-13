import { Array as Arr, MutableHashMap, Option } from "effect";

const MERMAID_META_REGEX =
  /\b(?<key>title|description)=(?<value>"[^"]*"|'[^']*'|[^\s]+)/gu;
const MERMAID_SQUARE_LABEL_REGEX =
  /(?<prefix>^|[^\w])(?<id>[A-Za-z_][\w-]*)(?<open>\[)(?!\[|\(|\/|\\)(?<label>[^\]\n]+)(?<close>\])/gu;
const MERMAID_ROUND_LABEL_REGEX =
  /(?<prefix>^|[^\w])(?<id>[A-Za-z_][\w-]*)(?<open>\()(?!\[|\()(?<label>[^()\n]+)(?<close>\))/gu;
const MERMAID_EDGE_MATH_LABEL_REGEX =
  /(?<open>\|)(?<label>[^|\n]*\$\$[^|\n]*)(?<close>\|)/gu;
const MERMAID_BACKTICK_DOLLAR_MATH_REGEX = /`\s*\$(?<math>[^$\n]+)\$\s*`/gu;
const MERMAID_BACKTICK_DOUBLE_DOLLAR_MATH_REGEX =
  /`\s*\$\$(?<math>[^$][\s\S]*?[^$]|\S)\$\$\s*`/gu;
const MERMAID_BACKTICK_PAREN_MATH_REGEX =
  /`\s*\\+\((?<math>[\s\S]*?)\\+\)\s*`/gu;
const MERMAID_MARKDOWN_INLINE_MATH_REGEX = /\\+\((?<math>[\s\S]*?)\\+\)/gu;
const MERMAID_MARKDOWN_DISPLAY_MATH_REGEX = /\\+\[(?<math>[\s\S]*?)\\+\]/gu;
const MERMAID_SINGLE_DOLLAR_MATH_REGEX =
  /(?<prefix>^|[^$\\])\$(?<math>[^$\n]+)\$(?!\$)/gu;
const LATEX_SIGNAL_PATTERN = /\\[a-zA-Z]+|\\[,;! ]/u;
const MATH_SYMBOL_PATTERN = /[=^_{}<>≤≥√∞±×÷∑∫]/u;
const MATH_OPERATOR_PATTERN = /(?:\d|\p{L})\s*(?:[+\-*/=<>])\s*(?:\d|\p{L})/u;
const SINGLE_VARIABLE_PATTERN = /^[A-Za-z](?:[_^][A-Za-z0-9{}]+)?$/u;
const MERMAID_FLOWCHART_DECLARATION_REGEX = /^(?:flowchart|graph)\b/u;
const UNESCAPED_QUOTE_REGEX = /(?<!\\)"/gu;

/**
 * Reads diagram copy from a markdown code fence info string. A field the fence
 * leaves out is `undefined`: the words that stand in for it are the reader's
 * language, so the renderer that knows the language chooses them.
 */
export function readMermaidMetadata(meta?: string | null) {
  const values = MutableHashMap.empty<string, string>();
  for (const match of (meta ?? "").matchAll(MERMAID_META_REGEX)) {
    const key = match[1];
    const rawValue = match[2];

    MutableHashMap.set(
      values,
      key,
      rawValue.replace(/^["']|["']$/gu, "").trim()
    );
  }

  const title = Option.getOrUndefined(MutableHashMap.get(values, "title"));
  const description = Option.getOrUndefined(
    MutableHashMap.get(values, "description")
  );

  return {
    description: description || undefined,
    title: title || undefined,
  };
}

/** Makes common LLM-generated flowchart labels safe for Mermaid parsing. */
export function normalizeMermaidChart(chart: string) {
  const chartWithMath = normalizeMermaidMath(chart);

  if (!isFlowchart(chartWithMath)) {
    return chartWithMath;
  }

  return normalizeFlowchartLabels(chartWithMath).replace(
    MERMAID_EDGE_MATH_LABEL_REGEX,
    (_match, open, label, close) =>
      `${open}"${normalizeMermaidLabel(label)}"${close}`
  );
}

function normalizeFlowchartLabels(chart: string) {
  return chart
    .replace(MERMAID_SQUARE_LABEL_REGEX, replaceFlowchartLabel)
    .replace(MERMAID_ROUND_LABEL_REGEX, replaceFlowchartLabel);
}

/**
 * Reads whether a position sits inside a quoted label: an odd number of
 * unescaped double quotes stands before it on its line.
 */
function isQuoted(text: string, offset: number) {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const quotes = text.slice(lineStart, offset).match(UNESCAPED_QUOTE_REGEX);
  return (quotes?.length ?? 0) % 2 === 1;
}

function replaceFlowchartLabel(
  match: string,
  prefix: string,
  id: string,
  open: string,
  label: string,
  close: string,
  offset: number,
  text: string
) {
  // Text inside a quoted label is the label's words, such as `E(C)` in
  // `A["C with E(C) = 28"]`, never a node of its own.
  if (isQuoted(text, offset)) {
    return match;
  }
  return `${prefix}${id}${open}"${normalizeMermaidLabel(label)}"${close}`;
}

function normalizeMermaidLabel(label: string) {
  const trimmedLabel = label.trim();
  const quote = trimmedLabel.at(0);
  const isQuoted =
    (quote === '"' || quote === "'") && trimmedLabel.endsWith(quote);
  const unquotedLabel = isQuoted ? trimmedLabel.slice(1, -1) : trimmedLabel;

  return normalizeMermaidMath(unquotedLabel).replaceAll('"', '\\"');
}

function normalizeMermaidMath(chart: string) {
  return chart
    .replace(MERMAID_BACKTICK_DOUBLE_DOLLAR_MATH_REGEX, (_, math) =>
      wrapMermaidMath(math)
    )
    .replace(MERMAID_BACKTICK_DOLLAR_MATH_REGEX, (_, math) =>
      wrapMermaidMath(math)
    )
    .replace(MERMAID_BACKTICK_PAREN_MATH_REGEX, (_, math) =>
      wrapMermaidMath(math)
    )
    .replace(MERMAID_MARKDOWN_INLINE_MATH_REGEX, (_, math) =>
      wrapMermaidMath(math)
    )
    .replace(MERMAID_MARKDOWN_DISPLAY_MATH_REGEX, (_, math) =>
      wrapMermaidMath(math)
    )
    .replace(MERMAID_SINGLE_DOLLAR_MATH_REGEX, (match, prefix, math) => {
      if (!isLikelyInlineMath(math)) {
        return match;
      }

      return `${prefix}${wrapMermaidMath(math)}`;
    });
}

function wrapMermaidMath(math: string) {
  return `$$${math.trim()}$$`;
}

function isLikelyInlineMath(content: string) {
  const text = content.trim();

  if (!text) {
    return false;
  }

  return (
    LATEX_SIGNAL_PATTERN.test(text) ||
    MATH_SYMBOL_PATTERN.test(text) ||
    MATH_OPERATOR_PATTERN.test(text) ||
    SINGLE_VARIABLE_PATTERN.test(text)
  );
}

function isFlowchart(chart: string) {
  return Arr.some(chart.split("\n"), (line) =>
    MERMAID_FLOWCHART_DECLARATION_REGEX.test(line.trim())
  );
}

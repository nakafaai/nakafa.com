const MERMAID_DEFAULT_DESCRIPTION = "Key ideas shown visually.";
const MERMAID_DEFAULT_TITLE = "Diagram";
const MERMAID_META_REGEX = /\b(title|description)=("[^"]*"|'[^']*'|[^\s]+)/g;
const MERMAID_SQUARE_LABEL_REGEX =
  /(^|[^\w])([A-Za-z_][\w-]*)(\[)([^\]\n]+)(\])/g;
const MERMAID_ROUND_LABEL_REGEX =
  /(^|[^\w])([A-Za-z_][\w-]*)(\()([^()\n]+)(\))/g;
const MERMAID_EDGE_MATH_LABEL_REGEX = /(\|)([^|\n]*\$\$[^|\n]*)(\|)/g;
const MERMAID_BACKTICK_DOLLAR_MATH_REGEX = /`\s*\$([^$\n]+)\$\s*`/g;
const MERMAID_BACKTICK_DOUBLE_DOLLAR_MATH_REGEX =
  /`\s*\$\$([^$][\s\S]*?[^$]|\S)\$\$\s*`/g;
const MERMAID_BACKTICK_PAREN_MATH_REGEX = /`\s*\\+\(([\s\S]*?)\\+\)\s*`/g;
const MERMAID_MARKDOWN_INLINE_MATH_REGEX = /\\+\(([\s\S]*?)\\+\)/g;
const MERMAID_MARKDOWN_DISPLAY_MATH_REGEX = /\\+\[([\s\S]*?)\\+\]/g;
const MERMAID_SINGLE_DOLLAR_MATH_REGEX = /(^|[^$\\])\$([^$\n]+)\$(?!\$)/g;
const LATEX_SIGNAL_PATTERN = /\\[a-zA-Z]+|\\[,;! ]/;
const MATH_SYMBOL_PATTERN = /[=^_{}<>≤≥√∞±×÷∑∫]/u;
const MATH_OPERATOR_PATTERN = /(?:\d|\p{L})\s*(?:[+\-*/=<>])\s*(?:\d|\p{L})/u;
const SINGLE_VARIABLE_PATTERN = /^[A-Za-z](?:[_^][A-Za-z0-9{}]+)?$/;
const MERMAID_FLOWCHART_DECLARATION_REGEX = /^(flowchart|graph)\b/;

/** Reads diagram copy from a markdown code fence info string. */
export function readMermaidMetadata(meta?: string | null) {
  const fallback = {
    description: MERMAID_DEFAULT_DESCRIPTION,
    title: MERMAID_DEFAULT_TITLE,
  };

  if (!meta) {
    return fallback;
  }

  const values = new Map<string, string>();
  for (const match of meta.matchAll(MERMAID_META_REGEX)) {
    const key = match[1];
    const rawValue = match[2];

    values.set(key, rawValue.replace(/^["']|["']$/g, "").trim());
  }

  const title = values.get("title");
  const description = values.get("description");

  return {
    description: description || fallback.description,
    title: title || fallback.title,
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

function replaceFlowchartLabel(
  _match: string,
  prefix: string,
  id: string,
  open: string,
  label: string,
  close: string
) {
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
  return chart
    .split("\n")
    .some((line) => MERMAID_FLOWCHART_DECLARATION_REGEX.test(line.trim()));
}

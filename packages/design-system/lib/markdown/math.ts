// Hoisted regex patterns to top-level scope for performance
const TRIPLE_BACKTICKS = /```/g;
// Detects math expressions in backticks with dollar signs: `$x^2$`
const DOLLAR_MATH_IN_BACKTICKS_GLOBAL = /`\s*\$([^$][\s\S]*?[^$]|\S)\$\s*`/g;
// Detects math expressions in backticks with double dollar signs: `$$x^2$$`
const DOUBLE_DOLLAR_MATH_IN_BACKTICKS_GLOBAL =
  /`\s*\$\$([^$][\s\S]*?[^$]|\S)\$\$\s*`/g;
// Detects math expressions in backticks with LaTeX parentheses: `\(x^2\)`
const PAREN_MATH_IN_BACKTICKS_GLOBAL = /`\s*\\\(([\s\S]*?)\\\)\s*`/g;
// Detects LaTeX display math with square brackets: \[x^2 + y^2 = z^2\]
const DISPLAY_MATH_BRACKETS_GLOBAL = /\\\[([\s\S]*?)\\\]/g;
// Detects LaTeX inline math with parentheses: \(x^2\)
const INLINE_PAREN_MATH_GLOBAL = /\\\(([\s\S]*?)\\\)/g;
// Detects malformed fenced math blocks: ```math x^2```
const FENCED_MATH_PATTERN = /```math([\s\S]*?)```/g;
// Detects HTML math tags: <math>x^2</math>
const MATH_TAG_PATTERN = /<math>([\s\S]*?)<\/math>/g;
// Detects MDX InlineMath components: <InlineMath math="x^2" />
const INLINE_MATH_COMPONENT_PATTERN =
  /<InlineMath\s+math=["']([^"']*?)["']\s*\/?>(?:<\/InlineMath>)?/g;
// Detects MDX BlockMath components: <BlockMath math="x^2" />
const BLOCK_MATH_COMPONENT_PATTERN =
  /<BlockMath\s+math=["']([^"']*?)["']\s*\/?>(?:<\/BlockMath>)?/g;
// Detects code blocks containing dollar math: ```\n$x^2$\n```
const CODE_BLOCK_WITH_SINGLE_DOLLAR_MATH_PATTERN =
  /```(?:\s*\n)?\s*\$\s*([\s\S]*?)\s*\$\s*(?:\n\s*)?```/g;
// Detects plain single-dollar spans outside code fences: $x^2$
const SINGLE_DOLLAR_SPAN_PATTERN = /(^|[^$\\])\$([^$\n]+)\$(?!\$)/g;
const LATEX_SIGNAL_PATTERN = /\\[a-zA-Z]+|\\[,;! ]/;
const MATH_SYMBOL_PATTERN = /[=^_{}<>≤≥√∞±×÷∑∫]/u;
const MATH_OPERATOR_PATTERN = /(?:\d|\p{L})\s*(?:[+\-*/=<>])\s*(?:\d|\p{L})/u;
const SINGLE_VARIABLE_PATTERN = /^[A-Za-z](?:[_^][A-Za-z0-9{}]+)?$/;
const ORDER_OR_ABSOLUTE_VALUE_PATTERN = /^\|[^|\n]*[\p{L}\\][^|\n]*\|$/u;
const FUNCTION_NOTATION_PATTERN =
  /^(?:\\?[A-Za-z]+|[A-Z])(?:_[A-Za-z0-9{}]+)?\([^()\n]*[\p{L}\\][^()\n]*\)$/u;
const QUOTIENT_NOTATION_PATTERN =
  /^[\p{L}\\][\p{L}\p{N}\\_{}]*(?:\([^()\n]*\))?\/[\p{L}\\][\p{L}\p{N}\\_{}]*(?:\([^()\n]*\))?$/u;
const TRIPLE_BACKTICK_LENGTH = 3;
const NUMBERED_LIST_PATTERN = /^(\s*)(\d+)\.\s+/;
const BULLET_LIST_PATTERN = /^(\s*)[-*+]\s+/;
const NON_WHITESPACE_START_PATTERN = /^\S/;
const BLOCKQUOTE_PREFIX_PATTERN = /^(\s*(?:>\s*)+)\s*$/;

/**
 * Applies a transform only to segments that are OUTSIDE of fenced code blocks (``` ... ```)
 */
function applyOutsideCodeFences(
  input: string,
  transform: (segment: string) => string
): string {
  TRIPLE_BACKTICKS.lastIndex = 0;
  let output = "";
  let cursor = 0;

  while (true) {
    const openMatch = TRIPLE_BACKTICKS.exec(input);

    if (!openMatch) {
      output += transform(input.slice(cursor));
      break;
    }

    const open = openMatch.index;

    // Transform the text before the code fence
    output += transform(input.slice(cursor, open));

    const closeMatch = TRIPLE_BACKTICKS.exec(input);

    if (!closeMatch) {
      // No closing fence: leave the rest untouched
      output += input.slice(open);
      break;
    }

    const closeEnd = closeMatch.index + TRIPLE_BACKTICK_LENGTH;

    // Preserve the code fence block unchanged
    output += input.slice(open, closeEnd);
    cursor = closeEnd;
  }

  TRIPLE_BACKTICKS.lastIndex = 0;
  return output;
}

/**
 * Detects if a position in the text is within a list item.
 * @param text - The full text
 * @param position - The position to check
 * @returns Object with isInList boolean and indentation string
 */
function getListContext(
  text: string,
  position: number
): { isInList: boolean; indentation: string } {
  // Check if current line or recent lines contain list markers
  const lines = text.slice(0, position).split("\n");

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      continue;
    }

    // Check for numbered list (1., 2., etc.)
    const numberedMatch = line.match(NUMBERED_LIST_PATTERN);
    if (numberedMatch) {
      const indentation = " ".repeat(numberedMatch[0].length);
      return { isInList: true, indentation };
    }

    // Check for bullet list (-, *, +)
    const bulletMatch = line.match(BULLET_LIST_PATTERN);
    if (bulletMatch) {
      const indentation = " ".repeat(bulletMatch[0].length);
      return { isInList: true, indentation };
    }

    // If this line starts at column 0 and isn't a list item, we're not in a list
    if (line.match(NON_WHITESPACE_START_PATTERN)) {
      break;
    }
  }

  return { isInList: false, indentation: "" };
}

/**
 * Returns the Markdown quote prefix when display math is the only content on a
 * blockquote line.
 */
function getBlockquotePrefix(text: string, position: number) {
  const lineStart = text.lastIndexOf("\n", position - 1) + 1;
  const linePrefix = text.slice(lineStart, position);
  const match = linePrefix.match(BLOCKQUOTE_PREFIX_PATTERN);

  return match?.[1];
}

/**
 * Creates a fenced math block with appropriate newlines based on context.
 * Adds LaTeX line breaks (\\) only when multi-line content lacks them.
 * @param inner - The math content
 * @param fullText - The complete text for context analysis
 * @param matchStart - Start position of the match
 * @returns Formatted math block
 */
function createFencedMathBlock(
  inner: string,
  fullText: string,
  matchStart: number
): string {
  const blockquotePrefix = getBlockquotePrefix(fullText, matchStart);
  const context = getListContext(fullText, matchStart);
  const mathContent = inner.trim();

  if (blockquotePrefix) {
    const quotedMath = mathContent
      .split("\n")
      .map((line) => `${blockquotePrefix}${line}`)
      .join("\n");

    return `\`\`\`math\n${quotedMath}\n${blockquotePrefix}\`\`\``;
  }

  if (context.isInList) {
    // In a list: use single newline and preserve indentation
    return `\n${context.indentation}\`\`\`math\n${context.indentation}${mathContent}\n${context.indentation}\`\`\`\n`;
  }
  // Not in a list: use double newlines for block separation
  return `\n\n\`\`\`math\n${mathContent}\n\`\`\`\n\n`;
}

/**
 * Checks whether a single-dollar span is math instead of ordinary currency text.
 */
function isLikelyInlineMath(content: string) {
  const text = content.trim();

  if (!text) {
    return false;
  }

  return (
    LATEX_SIGNAL_PATTERN.test(text) ||
    MATH_SYMBOL_PATTERN.test(text) ||
    MATH_OPERATOR_PATTERN.test(text) ||
    SINGLE_VARIABLE_PATTERN.test(text) ||
    ORDER_OR_ABSOLUTE_VALUE_PATTERN.test(text) ||
    FUNCTION_NOTATION_PATTERN.test(text) ||
    QUOTIENT_NOTATION_PATTERN.test(text)
  );
}

/**
 * Converts safe plain `$...$` spans into the double-dollar inline form parsed
 * by remark-math while single-dollar parsing stays disabled.
 */
function normalizeSingleDollarMath(segment: string) {
  return segment.replace(
    SINGLE_DOLLAR_SPAN_PATTERN,
    (match, prefix: string, content: string) => {
      if (!isLikelyInlineMath(content)) {
        return match;
      }

      return `${prefix}$$${content.trim()}$$`;
    }
  );
}

/**
 * Cleans up math delimiters in markdown text:
 * - $$ x^2 $$ → ```math\nx^2\n``` (block math with spacing)
 * - \[x^2\] → ```math\nx^2\n``` (block math)
 * - `$x^2$` → $$x^2$$ (removes wrong backticks, converts to inline)
 * - `$$x^2$$` → $$x^2$$ (removes wrong backticks from double dollar)
 * - \(x^2\) → $$x^2$$ (inline math)
 * - $$x^2$$ (no spacing) stays as inline math unchanged
 * - <math>x^2</math> → ```math\nx^2\n``` (block math)
 * - ```\n\frac{a}{b}\nc = d\n``` → ```math\n\frac{a}{b} \\\\\nc = d\n``` (LaTeX in code blocks + smart line breaks)
 */
function normalizeMathDelimiters(input: string): string {
  let processedInput = input;

  // Then, handle code blocks containing single dollar math expressions
  processedInput = processedInput.replace(
    CODE_BLOCK_WITH_SINGLE_DOLLAR_MATH_PATTERN,
    (_, inner: string, offset: number) =>
      createFencedMathBlock(inner, processedInput, offset)
  );

  // Then, clean up any malformed fenced math blocks. This is done before
  // the main processing to ensure they are properly formatted.
  processedInput = processedInput.replace(
    FENCED_MATH_PATTERN,
    (_, inner: string, offset: number) =>
      createFencedMathBlock(inner, processedInput, offset)
  );

  // Now, process the rest of the math delimiters outside of any code fences.
  return applyOutsideCodeFences(processedInput, (segment) => {
    let s = segment;

    // Convert MDX math components (LLM hallucinations) to proper formats
    s = s.replace(
      INLINE_MATH_COMPONENT_PATTERN, // <InlineMath math="x^2" /> → $$x^2$$
      (_, content: string) => `$$${content.trim()}$$`
    );
    s = s.replace(
      BLOCK_MATH_COMPONENT_PATTERN, // <BlockMath math="x^2" /> → ```math\nx^2\n```
      (_, inner: string, offset: number) =>
        createFencedMathBlock(inner, s, offset)
    );

    // Convert various inline math patterns to standard $$...$$ format
    const inlineMathPatterns = [
      DOLLAR_MATH_IN_BACKTICKS_GLOBAL, // `$x^2$` → $$x^2$$
      DOUBLE_DOLLAR_MATH_IN_BACKTICKS_GLOBAL, // `$$x^2$$` → $$x^2$$
      PAREN_MATH_IN_BACKTICKS_GLOBAL, // `\(x^2\)` → $$x^2$$
      INLINE_PAREN_MATH_GLOBAL, // \(x^2\) → $$x^2$$
    ];

    for (const pattern of inlineMathPatterns) {
      s = s.replace(pattern, (_, content: string) => `$$${content.trim()}$$`);
    }

    s = normalizeSingleDollarMath(s);

    // Convert all display math formats to fenced blocks
    const displayMathPatterns = [
      DISPLAY_MATH_BRACKETS_GLOBAL, // \[x^2\] → ```math\nx^2\n```
      MATH_TAG_PATTERN, // <math>x^2</math> → ```math\nx^2\n```
    ];

    for (const pattern of displayMathPatterns) {
      s = s.replace(pattern, (_, inner: string, offset: number) =>
        createFencedMathBlock(inner, s, offset)
      );
    }

    return s;
  });
}

/** Normalizes supported inline and display delimiters into fenced math blocks. */
export function preprocessLaTeX(text: string): string {
  if (!text) {
    return text;
  }

  return normalizeMathDelimiters(text);
}

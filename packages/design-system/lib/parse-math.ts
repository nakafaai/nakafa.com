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
const TRIPLE_BACKTICK_LENGTH = 3;
const NUMBERED_LIST_PATTERN = /^(\s*)(\d+)\.\s+/;
const BULLET_LIST_PATTERN = /^(\s*)[-]\s+/;
const NON_WHITESPACE_START_PATTERN = /^\S/;

/**
 * Applies a transform only to segments that are OUTSIDE of fenced code blocks (``` ... ```)
 */
function applyOutsideCodeFences(
  input: string,
  transform: (segment: string) => string,
): string {
  if (!TRIPLE_BACKTICKS.test(input)) {
    // Reset lastIndex side-effect of .test with global regex
    TRIPLE_BACKTICKS.lastIndex = 0;
    return transform(input);
  }
  TRIPLE_BACKTICKS.lastIndex = 0;

  let output = "";
  let cursor = 0;

  while (cursor < input.length) {
    const open = input.indexOf("```", cursor);
    if (open === -1) {
      output += transform(input.slice(cursor));
      break;
    }
    // Transform the text before the code fence
    output += transform(input.slice(cursor, open));
    const close = input.indexOf("```", open + TRIPLE_BACKTICK_LENGTH);
    if (close === -1) {
      // No closing fence: leave the rest untouched
      output += input.slice(open);
      break;
    }
    // Preserve the code fence block unchanged
    output += input.slice(open, close + TRIPLE_BACKTICK_LENGTH);
    cursor = close + TRIPLE_BACKTICK_LENGTH;
  }

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
  position: number,
): { isInList: boolean; indentation: string } {
  // Check if current line or recent lines contain list markers
  const lines = text.slice(0, position).split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      continue;
    }

    // Check for numbered list (1., 2., etc.)
    const numberedMatch = line.match(NUMBERED_LIST_PATTERN);
    if (numberedMatch) {
      const indentation = `${numberedMatch[1]}    `; // Base indentation + 4 spaces for content
      return { isInList: true, indentation };
    }

    // Check for bullet list (-, *, +)
    const bulletMatch = line.match(BULLET_LIST_PATTERN);
    if (bulletMatch) {
      const indentation = `${bulletMatch[1]}  `; // Base indentation + 2 spaces for content
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
  matchStart: number,
): string {
  const context = getListContext(fullText, matchStart);

  const mathContent = inner.trim();

  if (context.isInList) {
    // In a list: use single newline and preserve indentation
    return `\n${context.indentation}\`\`\`math\n${context.indentation}${mathContent}\n${context.indentation}\`\`\`\n`;
  }
  // Not in a list: use double newlines for block separation
  return `\n\n\`\`\`math\n${mathContent}\n\`\`\`\n\n`;
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
      createFencedMathBlock(inner, processedInput, offset),
  );

  // Then, clean up any malformed fenced math blocks. This is done before
  // the main processing to ensure they are properly formatted.
  processedInput = processedInput.replace(
    FENCED_MATH_PATTERN,
    (_, inner: string, offset: number) =>
      createFencedMathBlock(inner, processedInput, offset),
  );

  // Now, process the rest of the math delimiters outside of any code fences.
  return applyOutsideCodeFences(processedInput, (segment) => {
    let s = segment;

    // Convert MDX math components (LLM hallucinations) to proper formats
    s = s.replace(
      INLINE_MATH_COMPONENT_PATTERN, // <InlineMath math="x^2" /> → $$x^2$$
      (_, content: string) => `$$${content.trim()}$$`,
    );
    s = s.replace(
      BLOCK_MATH_COMPONENT_PATTERN, // <BlockMath math="x^2" /> → ```math\nx^2\n```
      (_, inner: string, offset: number) =>
        createFencedMathBlock(inner, s, offset),
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

    // Convert all display math formats to fenced blocks
    const displayMathPatterns = [
      DISPLAY_MATH_BRACKETS_GLOBAL, // \[x^2\] → ```math\nx^2\n```
      MATH_TAG_PATTERN, // <math>x^2</math> → ```math\nx^2\n```
    ];

    for (const pattern of displayMathPatterns) {
      s = s.replace(pattern, (_, inner: string, offset: number) =>
        createFencedMathBlock(inner, s, offset),
      );
    }

    return s;
  });
}

export function preprocessLaTeX(text: string): string {
  if (!text) {
    return text;
  }

  let result = text;

  result = normalizeMathDelimiters(result);

  return result;
}

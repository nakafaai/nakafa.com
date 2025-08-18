import { marked } from "marked";

// Hoisted regex patterns to top-level scope for performance
const LINK_IMAGE_PATTERN = /(!?\[)([^\]]*?)$/;
const INLINE_CODE_PATTERN = /(`)([^`]*?)$/;
const TRIPLE_BACKTICKS_GLOBAL = /```/g;
const ZERO_WIDTH_SPACE_GLOBAL = /\u200B/g;
const CARRIAGE_RETURN_GLOBAL = /\r/g;
const NON_WHITESPACE_PATTERN = /\S/;
const ESCAPED_NEWLINE_GLOBAL = /\\n/g;
const ESCAPED_CARRIAGE_RETURN_GLOBAL = /\\r/g;
const ESCAPED_TAB_GLOBAL = /\\t/g;
const TRIPLE_BACKTICKS = /```/g;
// Removes backticks from math: `$x^2$` → $x^2$
const DOLLAR_MATH_IN_BACKTICKS_GLOBAL = /`\s*\$([^$][\s\S]*?[^$]|\S)\$\s*`/g;
// Removes backticks from math: `\(x^2\)` → $x^2$
const PAREN_MATH_IN_BACKTICKS_GLOBAL = /`\s*\\\(([\s\S]*?)\\\)\s*`/g;
// Converts display math: \[x^2\] → ```math\nx^2\n```
const DISPLAY_MATH_BRACKETS_GLOBAL = /\\\[([\s\S]*?)\\\]/g;
// Converts display math: $$x^2$$ → ```math\nx^2\n```
const DISPLAY_MATH_DOUBLE_DOLLAR_GLOBAL = /\$\$([\s\S]*?)\$\$/g;
// Converts inline math: \(x^2\) → $x^2$
const INLINE_PAREN_MATH_GLOBAL = /\\\(([\s\S]*?)\\\)/g;
const TRAILING_WHITESPACE_PATTERN = /\s$/;
const LETTERED_LIST_PATTERN = /^(\s*)([a-z])\.\s+/gim;
// Cleans malformed fenced math: ```math x^2``` → ```math\nx^2\n```
const FENCED_MATH_PATTERN = /```math([\s\S]*?)```/g;
// Converts HTML math tags: <math>x^2</math> → ```math\nx^2\n```
const MATH_TAG_PATTERN = /<math>([\s\S]*?)<\/math>/g;
// Converts MDX InlineMath components: <InlineMath math="x^2" /> → $x^2$
const INLINE_MATH_COMPONENT_PATTERN =
  /<InlineMath\s+math=["']([^"']*?)["']\s*\/?>(?:<\/InlineMath>)?/g;
// Converts MDX BlockMath components: <BlockMath math="x^2" /> → ```math\nx^2\n```
const BLOCK_MATH_COMPONENT_PATTERN =
  /<BlockMath\s+math=["']([^"']*?)["']\s*\/?>(?:<\/BlockMath>)?/g;
// Converts code blocks with math: ```\n$x^2$\n``` → ```math\nx^2\n```
const CODE_BLOCK_WITH_SINGLE_DOLLAR_MATH_PATTERN =
  /```(?:\s*\n)?\s*\$\s*([\s\S]*?)\s*\$\s*(?:\n\s*)?```/g;
// Converts code blocks with LaTeX: ```\n\frac{a}{b}\n``` or ```plaintext\n\frac{a}{b}\n``` → ```math\n\frac{a}{b}\n```
const PLAINTEXT_BLOCK_WITH_LATEX_PATTERN =
  /```(?:plaintext|text)?[\s\n]*([\s\S]*?(?:\\(?:frac|times|pi|alpha|beta|gamma|theta|sigma|text|sqrt|sum|int|lim|infty|cdot|ldots|quad|left|right|div)\b|[°′″]|\w*\^\d+|\d+°|\w*\^2|\w*\^3|cm\^2|m\^2|km\^2)[\s\S]*?)[\s\n]*```/g;
const TRIPLE_BACKTICK_LENGTH = 3;
const NUMBERED_LIST_PATTERN = /^(\s*)(\d+)\.\s+/;
const BULLET_LIST_PATTERN = /^(\s*)[-]\s+/;
const NON_WHITESPACE_START_PATTERN = /^\S/;
const NUMBERED_LIST_SPACING_PATTERN = /^(\s*)(\d+)\.\s{2,}/gm;
const DASH_LIST_SPACING_PATTERN = /^(\s*)(-)\s{2,}/gm;
const MALFORMED_HEADING_PATTERN = /^(#{1,6})\s*#+\s*(.*?)$/gm;

/**
 * Parses markdown text into an array of blocks.
 * @param markdown - The markdown text to parse.
 * @returns An array of blocks.
 */
export function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => cleanMarkdown(token.raw));
}

/**
 * Converts lettered lists (e.g., "a.", "b.") to standard numbered lists.
 * This is a fallback for when the AI generates non-standard list formats.
 */
function convertLetteredListsToNumbered(input: string): string {
  if (!input) {
    return input;
  }
  // Finds lines starting with whitespace, a letter, a dot, and a space.

  return input.replace(LETTERED_LIST_PATTERN, (_match, whitespace, letter) => {
    // Convert letter to its corresponding number (a=1, b=2, c=3).
    const number = letter.toLowerCase().charCodeAt(0) - "a".charCodeAt(0) + 1;
    return `${whitespace}${number}. `;
  });
}

/**
 * Normalizes spacing in numbered lists to ensure consistent single space after number.
 * Converts "1.  " or "1.   " to "1. " (single space).
 */
function normalizeNumberedListSpacing(input: string): string {
  if (!input) {
    return input;
  }
  // Finds lines with numbered lists that have 2 or more spaces after the number and period.
  return input.replace(
    NUMBERED_LIST_SPACING_PATTERN,
    (_, whitespace, number) => `${whitespace}${number}. `
  );
}

/**
 * Normalizes spacing in dash bullet lists to ensure consistent single space after dash.
 * Converts "-  " or "-   " to "- " (single space).
 */
function normalizeDashListSpacing(input: string): string {
  if (!input) {
    return input;
  }
  // Finds lines with dash lists that have 2 or more spaces after the dash.
  return input.replace(
    DASH_LIST_SPACING_PATTERN,
    (_, whitespace, dash) => `${whitespace}${dash} `
  );
}

/**
 * Cleans malformed headings where LLMs generate extra # symbols inside the heading text.
 * Converts "## # Heading Text" to "## Heading Text" and similar cases.
 */
function cleanMalformedHeadings(input: string): string {
  if (!input) {
    return input;
  }
  // Finds lines starting with 1-6 #s, followed by optional whitespace,
  // then one or more additional #s, then the actual heading text.
  return input.replace(
    MALFORMED_HEADING_PATTERN,
    (_, headingLevel, headingText) => `${headingLevel} ${headingText.trim()}`
  );
}

/**
 * Cleans a markdown string by removing insignificant whitespace-only content.
 * Returns an empty string when the input contains no visible characters
 * (e.g., only newlines like "\n\n" or spaces), so callers can skip rendering.
 */
export function cleanMarkdown(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  // Normalize common invisible characters and trim edges
  const normalized = input
    .replace(ZERO_WIDTH_SPACE_GLOBAL, "")
    .replace(CARRIAGE_RETURN_GLOBAL, "");
  const trimmed = normalized.trim();
  // If there are no non-whitespace characters, treat as empty
  if (!NON_WHITESPACE_PATTERN.test(trimmed)) {
    return "";
  }
  // Special case: content that is only escaped sequences like "\n\n" or "\t\n"
  const afterRemovingEscapes = trimmed
    .replace(ESCAPED_NEWLINE_GLOBAL, "")
    .replace(ESCAPED_CARRIAGE_RETURN_GLOBAL, "")
    .replace(ESCAPED_TAB_GLOBAL, "")
    .trim();
  if (afterRemovingEscapes.length === 0) {
    return "";
  }

  return trimmed;
}

/**
 * Removes unterminated links or images from the input string.
 * @param input - The input string to remove unterminated links or images from.
 * @returns The input string with unterminated links or images removed.
 */
export function removeUnterminatedLinkOrImage(input: string): string {
  const match = input.match(LINK_IMAGE_PATTERN);
  if (!match) {
    return input;
  }
  const startIndex = input.lastIndexOf(match[1]);
  return input.substring(0, startIndex);
}

/**
 * Completes inline code formatting in the input string.
 * @param input - The input string to complete inline code formatting in.
 * @returns The input string with inline code formatting completed.
 */
export function completeInlineCodeFormatting(input: string): string {
  if (!input.match(INLINE_CODE_PATTERN)) {
    return input;
  }
  const allTripleBackticks = (input.match(TRIPLE_BACKTICKS_GLOBAL) || [])
    .length;
  const insideIncompleteCodeBlock = allTripleBackticks % 2 === 1;
  if (insideIncompleteCodeBlock) {
    return input;
  }

  let singleBacktickCount = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== "`") {
      continue;
    }
    const isTripleStart =
      input.substring(i, i + TRIPLE_BACKTICK_LENGTH) === "```";
    const isTripleMiddle = i > 0 && input.substring(i - 1, i + 2) === "```";
    const isTripleEnd = i > 1 && input.substring(i - 2, i + 1) === "```";
    if (!(isTripleStart || isTripleMiddle || isTripleEnd)) {
      singleBacktickCount++;
    }
  }
  if (
    singleBacktickCount % 2 === 1 &&
    !TRAILING_WHITESPACE_PATTERN.test(input)
  ) {
    return `${input}\``;
  }
  return input;
}

/**
 * Applies a transform only to segments that are OUTSIDE of fenced code blocks (``` ... ```)
 */
export function applyOutsideCodeFences(
  input: string,
  transform: (segment: string) => string
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
  position: number
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
  matchStart: number
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
 * - $$x^2$$ → ```math\nx^2\n``` (block math)
 * - \[x^2\] → ```math\nx^2\n``` (block math)
 * - `$x^2$` → $x^2$ (removes wrong backticks)
 * - \(x^2\) → $x^2$ (inline math)
 * - <math>x^2</math> → ```math\nx^2\n``` (block math)
 * - ```\n\frac{a}{b}\nc = d\n``` → ```math\n\frac{a}{b} \\\\\nc = d\n``` (LaTeX in code blocks + smart line breaks)
 */
export function normalizeMathDelimiters(input: string): string {
  // First, convert plaintext code blocks that contain LaTeX commands to math blocks
  let processedInput = input.replace(
    PLAINTEXT_BLOCK_WITH_LATEX_PATTERN,
    (_, inner: string, offset: number) =>
      createFencedMathBlock(inner, input, offset)
  );

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
      INLINE_MATH_COMPONENT_PATTERN,
      (_, content: string) => `$${content.trim()}$`
    );
    s = s.replace(
      BLOCK_MATH_COMPONENT_PATTERN,
      (_, inner: string, offset: number) =>
        createFencedMathBlock(inner, s, offset)
    );

    // Convert various inline math patterns to standard $...$ format
    const inlineMathPatterns = [
      DOLLAR_MATH_IN_BACKTICKS_GLOBAL, // `$x^2$` → $x^2$
      PAREN_MATH_IN_BACKTICKS_GLOBAL, // `\(x^2\)` → $x^2$
      INLINE_PAREN_MATH_GLOBAL, // \(x^2\) → $x^2$
    ];

    for (const pattern of inlineMathPatterns) {
      s = s.replace(pattern, (_, content: string) => `$${content.trim()}$`);
    }

    // Convert all display math formats to fenced blocks
    const displayMathPatterns = [
      DISPLAY_MATH_BRACKETS_GLOBAL, // \[x^2\] → ```math\nx^2\n```
      DISPLAY_MATH_DOUBLE_DOLLAR_GLOBAL, // $$x^2$$ → ```math\nx^2\n```
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

/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
export function parseMarkdown(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let result = text;

  // Clean malformed headings where LLMs put # symbols inside heading text.
  result = cleanMalformedHeadings(result);

  // Convert lettered lists before other parsing to ensure consistency.
  result = convertLetteredListsToNumbered(result);

  // Normalize spacing in numbered lists to ensure single space after number.
  result = normalizeNumberedListSpacing(result);

  // Normalize spacing in dash bullet lists to ensure single space after dash.
  result = normalizeDashListSpacing(result);

  // Remove unterminated links or images
  result = removeUnterminatedLinkOrImage(result);

  // Complete inline code formatting
  result = completeInlineCodeFormatting(result);

  // Sanitize math/markdown outside of fenced code blocks to avoid hallucinated formatting
  result = normalizeMathDelimiters(result);

  return result;
}

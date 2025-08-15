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
const DISPLAY_MATH_DOLLARS_GLOBAL = /\$\$([\s\S]*?)\$\$/g;
const DISPLAY_MATH_BRACKETS_GLOBAL = /\\\[([\s\S]*?)\\\]/g;
const INLINE_MATH_IN_BACKTICKS_GLOBAL = /`\s*\$([^`$]*?)\$\s*`/g;
const INLINE_PAREN_MATH_IN_BACKTICKS_GLOBAL = /`\s*\\\(([^`]*?)\\\)\s*`/g;
const DISPLAY_MATH_IN_BACKTICKS_GLOBAL = /`\s*\$\$([\s\S]*?)\$\$\s*`/g;
const INLINE_SINGLE_DOLLAR_GLOBAL = /\$(?!\$)\s*([^$]*?)\s*\$(?!\$)/g;
const INLINE_PAREN_MATH_GLOBAL = /\\\(([\s\S]*?)\\\)/g;
const TRAILING_WHITESPACE_PATTERN = /\s$/;
const LETTERED_LIST_PATTERN = /^(\s*)([a-z])\.\s+/gim;
const FENCED_MATH_PATTERN = /```math([\s\S]*?)```/g;
const TRIPLE_BACKTICK_LENGTH = 3;

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
 * Converts display math $$...$$ and \[...\] into fenced math blocks, removes backticks
 * around inline math, and normalizes spacing for inline $...$.
 */
export function normalizeMathDelimiters(input: string): string {
  // First, clean up any malformed fenced math blocks. This is done before
  // the main processing to ensure they are properly formatted.
  const cleanedInput = input.replace(
    FENCED_MATH_PATTERN,
    (_, inner: string) => `\n\n\`\`\`math\n${inner.trim()}\n\`\`\`\n\n`
  );

  // Now, process the rest of the math delimiters outside of any code fences.
  return applyOutsideCodeFences(cleanedInput, (segment) => {
    let s = segment;

    // Strip backticks around inline TeX $...$ and \(...\)
    s = s.replace(
      INLINE_MATH_IN_BACKTICKS_GLOBAL,
      (_, inner: string) => `$${inner.trim()}$`
    );
    s = s.replace(
      INLINE_PAREN_MATH_IN_BACKTICKS_GLOBAL,
      (_, inner: string) => `$${inner.trim()}$`
    );

    // Convert bare inline parenthesis math \(...\) to $...$ first,
    // so later replacements don't accidentally run inside newly inserted fences
    s = s.replace(
      INLINE_PAREN_MATH_GLOBAL,
      (_, inner: string) => `$${inner.trim()}$`
    );

    // Convert display math wrapped in backticks to fenced math
    s = s.replace(
      DISPLAY_MATH_IN_BACKTICKS_GLOBAL,
      (_, inner: string) => `\n\n\`\`\`math\n${inner.trim()}\n\`\`\`\n\n`
    );

    // Convert $$...$$ to fenced math blocks
    s = s.replace(
      DISPLAY_MATH_DOLLARS_GLOBAL,
      (_, inner: string) => `\n\n\`\`\`math\n${inner.trim()}\n\`\`\`\n\n`
    );

    // Convert \[...\] to fenced math blocks
    s = s.replace(
      DISPLAY_MATH_BRACKETS_GLOBAL,
      (_, inner: string) => `\n\n\`\`\`math\n${inner.trim()}\n\`\`\`\n\n`
    );

    // Normalize spacing inside inline single-dollar math
    s = s.replace(
      INLINE_SINGLE_DOLLAR_GLOBAL,
      (_, inner: string) => `$${inner.trim()}$`
    );

    return s;
  });
}

/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
export function parseIncompleteMarkdown(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let result = text;

  // Convert lettered lists before other parsing to ensure consistency.
  result = convertLetteredListsToNumbered(result);

  result = removeUnterminatedLinkOrImage(result);

  result = completeInlineCodeFormatting(result);

  // Sanitize math/markdown outside of fenced code blocks to avoid hallucinated formatting
  result = normalizeMathDelimiters(result);

  return result;
}

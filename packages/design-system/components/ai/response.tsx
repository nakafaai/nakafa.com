"use client";

import { cn } from "@repo/design-system/lib/utils";
import { reactMdxComponents } from "@repo/design-system/markdown/react-mdx";
import hardenReactMarkdown from "harden-react-markdown";
import { marked } from "marked";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo, useMemo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";

// Hoisted regex patterns to top-level scope for performance
const LINK_IMAGE_PATTERN = /(!?\[)([^\]]*?)$/;
const BOLD_PATTERN = /(\*\*)([^*]*?)$/;
const ITALIC_PATTERN = /(__)([^_]*?)$/;
const SINGLE_ASTERISK_PATTERN = /(\*)([^*]*?)$/;
const SINGLE_UNDERSCORE_PATTERN = /(_)([^_]*?)$/;
const INLINE_CODE_PATTERN = /(`)([^`]*?)$/;
const TRIPLE_BACKTICKS_GLOBAL = /```/g;
const ASTERISK_PAIRS_GLOBAL = /\*\*/g;
const UNDERSCORE_PAIRS_GLOBAL = /__/g;
const STRIKETHROUGH_PATTERN = /(~~)([^~]*?)$/;
const STRIKETHROUGH_PAIRS_GLOBAL = /~~/g;
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

/**
 * Cleans a markdown string by removing insignificant whitespace-only content.
 * Returns an empty string when the input contains no visible characters
 * (e.g., only newlines like "\n\n" or spaces), so callers can skip rendering.
 */
function cleanMarkdown(input: string): string {
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

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

function removeUnterminatedLinkOrImage(input: string): string {
  const match = input.match(LINK_IMAGE_PATTERN);
  if (!match) {
    return input;
  }
  const startIndex = input.lastIndexOf(match[1]);
  return input.substring(0, startIndex);
}

function completeBoldFormatting(input: string): string {
  if (!input.match(BOLD_PATTERN)) {
    return input;
  }
  const asteriskPairs = (input.match(ASTERISK_PAIRS_GLOBAL) || []).length;
  if (asteriskPairs % 2 === 1 && !TRAILING_WHITESPACE_PATTERN.test(input)) {
    return `${input}**`;
  }
  return input;
}

function completeDoubleUnderscoreItalicFormatting(input: string): string {
  if (!input.match(ITALIC_PATTERN)) {
    return input;
  }
  const underscorePairs = (input.match(UNDERSCORE_PAIRS_GLOBAL) || []).length;
  if (underscorePairs % 2 === 1 && !TRAILING_WHITESPACE_PATTERN.test(input)) {
    return `${input}__`;
  }
  return input;
}

function completeSingleAsteriskItalicFormatting(input: string): string {
  if (!input.match(SINGLE_ASTERISK_PATTERN)) {
    return input;
  }
  const singleAsterisks = input.split("").reduce((count, char, index) => {
    if (char !== "*") {
      return count;
    }
    const prevChar = input[index - 1];
    const nextChar = input[index + 1];
    return prevChar !== "*" && nextChar !== "*" ? count + 1 : count;
  }, 0);
  if (singleAsterisks % 2 === 1 && !TRAILING_WHITESPACE_PATTERN.test(input)) {
    return `${input}*`;
  }
  return input;
}

function completeSingleUnderscoreItalicFormatting(input: string): string {
  if (!input.match(SINGLE_UNDERSCORE_PATTERN)) {
    return input;
  }
  const singleUnderscores = input.split("").reduce((count, char, index) => {
    if (char !== "_") {
      return count;
    }
    const prevChar = input[index - 1];
    const nextChar = input[index + 1];
    return prevChar !== "_" && nextChar !== "_" ? count + 1 : count;
  }, 0);
  if (singleUnderscores % 2 === 1 && !TRAILING_WHITESPACE_PATTERN.test(input)) {
    return `${input}_`;
  }
  return input;
}

function completeInlineCodeFormatting(input: string): string {
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
    const isTripleStart = input.substring(i, i + 3) === "```";
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

function completeStrikethroughFormatting(input: string): string {
  if (!input.match(STRIKETHROUGH_PATTERN)) {
    return input;
  }
  const tildePairs = (input.match(STRIKETHROUGH_PAIRS_GLOBAL) || []).length;
  if (tildePairs % 2 === 1 && !TRAILING_WHITESPACE_PATTERN.test(input)) {
    return `${input}~~`;
  }
  return input;
}

/**
 * Applies a transform only to segments that are OUTSIDE of fenced code blocks (``` ... ```)
 */
function applyOutsideCodeFences(
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
    const close = input.indexOf("```", open + 3);
    if (close === -1) {
      // No closing fence: leave the rest untouched
      output += input.slice(open);
      break;
    }
    // Preserve the code fence block unchanged
    output += input.slice(open, close + 3);
    cursor = close + 3;
  }

  return output;
}

/**
 * Converts display math $$...$$ and \[...\] into fenced math blocks, removes backticks
 * around inline math, and normalizes spacing for inline $...$.
 */
function sanitizeMathOutsideCodeFences(input: string): string {
  return applyOutsideCodeFences(input, (segment) => {
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
function parseIncompleteMarkdown(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let result = text;

  result = removeUnterminatedLinkOrImage(result);
  result = completeBoldFormatting(result);
  result = completeDoubleUnderscoreItalicFormatting(result);
  result = completeSingleAsteriskItalicFormatting(result);
  result = completeSingleUnderscoreItalicFormatting(result);
  result = completeInlineCodeFormatting(result);
  result = completeStrikethroughFormatting(result);

  // Sanitize math/markdown outside of fenced code blocks to avoid hallucinated formatting
  result = sanitizeMathOutsideCodeFences(result);

  return result;
}

// Create a hardened version of ReactMarkdown
const HardenedMarkdown = memo(
  hardenReactMarkdown(ReactMarkdown),
  (prevProps, nextProps) => {
    return prevProps.children === nextProps.children;
  }
);

export type ResponseProps = HTMLAttributes<HTMLDivElement> & {
  options?: Options;
  children: Options["children"];
  allowedImagePrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedImagePrefixes"];
  allowedLinkPrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["allowedLinkPrefixes"];
  defaultOrigin?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >["defaultOrigin"];
  parseIncompleteMarkdown?: boolean;
};

export const Response = memo(
  ({
    className,
    options,
    children,
    allowedImagePrefixes,
    allowedLinkPrefixes,
    defaultOrigin = "https://nakafa.com",
    parseIncompleteMarkdown: shouldParseIncompleteMarkdown = true,
    ...props
  }: ResponseProps) => {
    // Parse the children to remove incomplete markdown tokens if enabled
    const blocksMarkdown = useMemo(() => {
      if (typeof children !== "string") {
        return [];
      }
      const parsed = shouldParseIncompleteMarkdown
        ? parseIncompleteMarkdown(children)
        : children;
      return parseMarkdownIntoBlocks(cleanMarkdown(parsed)).filter(
        (block) => block.length > 0
      );
    }, [children, shouldParseIncompleteMarkdown]);

    if (blocksMarkdown.length === 0) {
      return null;
    }

    return (
      <div
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        {...props}
      >
        {blocksMarkdown.map((block, index) => (
          <HardenedMarkdown
            allowedImagePrefixes={allowedImagePrefixes ?? ["*"]}
            allowedLinkPrefixes={allowedLinkPrefixes ?? ["*"]}
            components={reactMdxComponents}
            defaultOrigin={defaultOrigin}
            // biome-ignore lint/suspicious/noArrayIndexKey: We need to use the index as key to prevent the component from re-rendering
            key={`block-${block}-index-${index}`}
            remarkPlugins={[remarkGfm, remarkMath, remarkRehype]}
            {...options}
          >
            {block}
          </HardenedMarkdown>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

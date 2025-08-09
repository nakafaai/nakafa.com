"use client";

import { cn } from "@repo/design-system/lib/utils";
import { reactMdxComponents } from "@repo/design-system/markdown/react-mdx";
import hardenReactMarkdown from "harden-react-markdown";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

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
  return asteriskPairs % 2 === 1 ? `${input}**` : input;
}

function completeDoubleUnderscoreItalicFormatting(input: string): string {
  if (!input.match(ITALIC_PATTERN)) {
    return input;
  }
  const underscorePairs = (input.match(UNDERSCORE_PAIRS_GLOBAL) || []).length;
  return underscorePairs % 2 === 1 ? `${input}__` : input;
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
  return singleAsterisks % 2 === 1 ? `${input}*` : input;
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
  return singleUnderscores % 2 === 1 ? `${input}_` : input;
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
  return singleBacktickCount % 2 === 1 ? `${input}\`` : input;
}

function completeStrikethroughFormatting(input: string): string {
  if (!input.match(STRIKETHROUGH_PATTERN)) {
    return input;
  }
  const tildePairs = (input.match(STRIKETHROUGH_PAIRS_GLOBAL) || []).length;
  return tildePairs % 2 === 1 ? `${input}~~` : input;
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

  return result;
}

// Create a hardened version of ReactMarkdown
const HardenedMarkdown = hardenReactMarkdown(ReactMarkdown);

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
    defaultOrigin,
    parseIncompleteMarkdown: shouldParseIncompleteMarkdown = true,
    ...props
  }: ResponseProps) => {
    // Parse the children to remove incomplete markdown tokens if enabled
    const parsedChildren =
      typeof children === "string" && shouldParseIncompleteMarkdown
        ? parseIncompleteMarkdown(children)
        : children;

    return (
      <div
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        {...props}
      >
        <HardenedMarkdown
          allowedImagePrefixes={allowedImagePrefixes ?? ["*"]}
          allowedLinkPrefixes={allowedLinkPrefixes ?? ["*"]}
          components={reactMdxComponents}
          defaultOrigin={defaultOrigin}
          rehypePlugins={[rehypeKatex]}
          remarkPlugins={[remarkGfm, remarkMath]}
          {...options}
        >
          {parsedChildren}
        </HardenedMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

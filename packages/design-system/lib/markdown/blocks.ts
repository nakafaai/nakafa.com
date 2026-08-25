import { Lexer } from "marked";

const HASH_MODULO = 1_000_000_007;
const HASH_MULTIPLIER = 31;

export interface MarkdownBlockModel {
  readonly content: string;
  readonly key: string;
}

/** Preserves Marked block boundaries while rejoining split display-math fences. */
export const parseMarkdownIntoBlocks = (markdown: string): string[] => {
  const tokens = Lexer.lex(markdown, { gfm: true });
  const blocks = tokens.map((token) => token.raw);

  // Post-process to merge consecutive blocks that are part of the same math block
  const mergedBlocks: string[] = [];

  for (const currentBlock of blocks) {
    // Check if this is a standalone $$ that might be a closing delimiter
    if (currentBlock.trim() === "$$" && mergedBlocks.length > 0) {
      const previousBlock = mergedBlocks.at(-1);

      if (!previousBlock) {
        continue;
      }

      // Check if the previous block starts with $$ but doesn't end with $$
      const prevStartsWith$$ = previousBlock.trimStart().startsWith("$$");
      const prevDollarCount = countDisplayMathDelimiters(previousBlock);

      // If previous block has odd number of $$ and starts with $$, merge them
      if (prevStartsWith$$ && prevDollarCount % 2 === 1) {
        mergedBlocks[mergedBlocks.length - 1] = previousBlock + currentBlock;
        continue;
      }
    }

    // Check if current block ends with $$ and previous block started with $$ but didn't close
    if (mergedBlocks.length > 0 && currentBlock.trimEnd().endsWith("$$")) {
      const previousBlock = mergedBlocks.at(-1);

      if (!previousBlock) {
        continue;
      }

      const prevStartsWith$$ = previousBlock.trimStart().startsWith("$$");
      const prevDollarCount = countDisplayMathDelimiters(previousBlock);
      const currDollarCount = countDisplayMathDelimiters(currentBlock);

      // If previous block has unclosed math (odd $$) and current block ends with $$
      // AND current block doesn't start with $$, it's likely a continuation
      if (
        prevStartsWith$$ &&
        prevDollarCount % 2 === 1 &&
        !currentBlock.trimStart().startsWith("$$") &&
        currDollarCount === 1
      ) {
        mergedBlocks[mergedBlocks.length - 1] = previousBlock + currentBlock;
        continue;
      }
    }

    mergedBlocks.push(currentBlock);
  }

  return mergedBlocks;
};

/** Counts display-math delimiters without treating unmatched text as failure. */
function countDisplayMathDelimiters(value: string) {
  return value.split("$$").length - 1;
}

/** Creates stable block identities for streamed and static markdown alike. */
export function readMarkdownBlocks(
  responseId: string,
  markdown: string
): readonly MarkdownBlockModel[] {
  const occurrences = new Map<string, number>();

  return parseMarkdownIntoBlocks(markdown).map((content) => {
    const duplicateIndex = occurrences.get(content) ?? 0;
    occurrences.set(content, duplicateIndex + 1);

    return {
      content,
      key: `${responseId}-block-${hashString(content)}-${duplicateIndex}`,
    };
  });
}

/** Creates a compact deterministic hash for React block keys. */
function hashString(value: string) {
  let hash = 0;

  for (const char of value) {
    hash = (hash * HASH_MULTIPLIER + char.charCodeAt(0)) % HASH_MODULO;
  }

  return hash.toString(36);
}

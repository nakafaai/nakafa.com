import { Lexer } from "marked";

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
    const previousBlock = mergedBlocks.at(-1);
    const hasUnclosedMath =
      previousBlock?.trimStart().startsWith("$$") &&
      countDisplayMathDelimiters(previousBlock) % 2 === 1;
    const closesMath =
      currentBlock.trim() === "$$" ||
      (currentBlock.trimEnd().endsWith("$$") &&
        !currentBlock.trimStart().startsWith("$$") &&
        countDisplayMathDelimiters(currentBlock) === 1);

    if (hasUnclosedMath && closesMath) {
      mergedBlocks[mergedBlocks.length - 1] = previousBlock + currentBlock;
      continue;
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
  let offset = 0;

  return parseMarkdownIntoBlocks(markdown).map((content) => {
    const start = offset;
    offset += content.length;

    return {
      content,
      key: `${responseId}-block-${start}`,
    };
  });
}

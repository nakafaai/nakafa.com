import { Array as Arr, MutableList, Schema } from "effect";
import { Lexer } from "marked";

const MarkdownBlockModelSchema = Schema.Struct({
  content: Schema.String,
  key: Schema.String,
});
type MarkdownBlockModel = typeof MarkdownBlockModelSchema.Type;

/** Preserves Marked block boundaries while rejoining split display-math fences. */
export const parseMarkdownIntoBlocks = (markdown: string): string[] => {
  const tokens = Lexer.lex(markdown, { gfm: true });
  const blocks = Arr.map(tokens, (token) => token.raw);

  // Post-process to merge consecutive blocks that are part of the same math block.
  // The newest block stays pending, because a later block may still extend it.
  const mergedBlocks = MutableList.make<string>();
  let pendingBlock: string | undefined;

  for (const currentBlock of blocks) {
    const previousBlock = pendingBlock;
    const hasUnclosedMath =
      previousBlock?.trimStart().startsWith("$$") &&
      countDisplayMathDelimiters(previousBlock) % 2 === 1;
    const closesMath =
      currentBlock.trim() === "$$" ||
      (currentBlock.trimEnd().endsWith("$$") &&
        !currentBlock.trimStart().startsWith("$$") &&
        countDisplayMathDelimiters(currentBlock) === 1);

    if (hasUnclosedMath && closesMath) {
      pendingBlock = previousBlock + currentBlock;
      continue;
    }

    if (previousBlock !== undefined) {
      MutableList.append(mergedBlocks, previousBlock);
    }
    pendingBlock = currentBlock;
  }

  if (pendingBlock !== undefined) {
    MutableList.append(mergedBlocks, pendingBlock);
  }
  return MutableList.toArray(mergedBlocks);
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

  return Arr.map(parseMarkdownIntoBlocks(markdown), (content) => {
    const start = offset;
    offset += content.length;

    return {
      content,
      key: `${responseId}-block-${start}`,
    };
  });
}

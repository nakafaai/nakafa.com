import { isEmptyMarker } from "@repo/design-system/components/editor/plain";
import { Array as Arr, Match } from "effect";
import type { Token } from "marked-tiptap";

/**
 * Whether inline tokens hold no words: none at all, or only the marker of an
 * empty paragraph.
 */
export function isEmptyText(tokens: readonly Token[]) {
  return Arr.isReadonlyArrayEmpty(tokens) || isEmptyMarker(tokens);
}

/**
 * Whether a block is a text block that holds no words: a paragraph, a heading
 * or a code block with no text. Tiptap counts each of them as an empty block.
 */
function isEmptyBlock(token: Token) {
  return Match.value(token).pipe(
    Match.whenOr({ type: "paragraph" }, { type: "heading" }, ({ tokens }) =>
      isEmptyText(tokens)
    ),
    Match.when({ type: "code" }, ({ text }) => text === ""),
    Match.orElse(() => false)
  );
}

/**
 * Whether the editor shows its hint for the blocks of a memory: there is no
 * block, or every block is an empty text block. Spacing draws nothing. The
 * editor marks its first block with the hint, and so does the preview. A list
 * or a quote is never an empty text block here, even when it holds no words.
 */
export function isEmptyDocument(tokens: readonly Token[]) {
  return Arr.every(
    Arr.filter(tokens, (token) => token.type !== "space"),
    isEmptyBlock
  );
}

import { reader } from "@repo/design-system/components/editor/plain";
import { Array as Arr } from "effect";
import type { Token } from "marked-tiptap";

/** A token with the key that keeps it apart from its siblings when it renders. */
export interface Keyed<T extends Token> {
  readonly key: string;
  readonly token: T;
}

/**
 * Gives each token of a list of siblings a key of its own. The key counts the
 * tokens, so two tokens with the same words, such as two equal paragraphs or two
 * blank lines, never share a key. The list is never reordered while it shows.
 */
export function keyed<T extends Token>(
  tokens: readonly T[]
): readonly Keyed<T>[] {
  return Arr.mapAccum(tokens, 0, (count, token) => [
    count + 1,
    { key: `${count}`, token },
  ])[1];
}

/** The blocks of the Markdown of a memory, in the order the editor shows them. */
export function blocksOf(markdown: string) {
  return keyed(reader.lexer(markdown));
}

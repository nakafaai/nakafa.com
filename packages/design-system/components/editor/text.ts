import type { JSONContent } from "@tiptap/core";
import { String as Str } from "effect";

/** Matches a run of white space, line breaks included. */
const WHITE_SPACE = /\s+/gu;

/**
 * Turns any text into one line: each run of white space, line breaks included,
 * becomes one space. Pasted text goes through it before it reaches the editor.
 */
export function flattenText(text: string) {
  return Str.replace(WHITE_SPACE, " ")(text);
}

/**
 * Whether text can be saved. Without the white space at its edges it holds
 * something and fits `limit`, which is how the stored text is measured.
 */
export function canSaveText(text: string, limit: number) {
  const length = Str.length(Str.trim(text));

  return length > 0 && length <= limit;
}

/**
 * The document of one paragraph that holds `text`, built as data so the text
 * is never read as HTML. An empty paragraph holds no text node, because the
 * editor refuses an empty one.
 */
export function toDocument(text: string): JSONContent {
  return {
    content: [
      {
        content: Str.isEmpty(text) ? [] : [{ text, type: "text" }],
        type: "paragraph",
      },
    ],
    type: "doc",
  };
}

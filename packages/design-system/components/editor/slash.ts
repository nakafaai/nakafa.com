import type { ChainedCommands, Editor, Range } from "@tiptap/core";
import { Array as Arr, String as Str } from "effect";

/** The blocks that the slash menu inserts, in the order the menu lists them. */
export const SLASH_KEYS = [
  "text",
  "heading-1",
  "heading-2",
  "heading-3",
  "bullets",
  "numbers",
  "quote",
  "code-block",
  "table",
] as const;

/** One block of the slash menu. */
export type SlashKey = (typeof SLASH_KEYS)[number];

/** The names that the menu shows for each block, in the reader's language. */
export type SlashLabels = Record<SlashKey, string>;

/**
 * The short names that also find a block, such as `h1` for a heading, so a writer who
 * knows the tag finds the block as well as one who knows its name.
 */
const SHORT_NAMES: Record<SlashKey, readonly string[]> = {
  bullets: ["ul", "list"],
  "code-block": ["code", "pre"],
  numbers: ["ol", "list"],
  quote: ["blockquote"],
  table: ["grid"],
  text: ["p", "paragraph"],
  "heading-1": ["h1"],
  "heading-2": ["h2"],
  "heading-3": ["h3"],
};

/**
 * The keys whose name or short name contains the query, ignoring case and the spaces
 * around it, in the order of the menu. An empty query keeps every key.
 */
export function filterSlash(labels: SlashLabels, query: string): SlashKey[] {
  const needle = Str.toLowerCase(Str.trim(query));
  return Arr.filter(
    SLASH_KEYS,
    (key) =>
      needle === "" ||
      Arr.some([labels[key], ...SHORT_NAMES[key]], (word) =>
        Str.toLowerCase(word).includes(needle)
      )
  );
}

/** The command that makes each block, given the chain that already removes the slash query. */
const COMMANDS: Record<SlashKey, (chain: ChainedCommands) => ChainedCommands> =
  {
    bullets: (chain) => chain.toggleBulletList(),
    "code-block": (chain) => chain.toggleCodeBlock(),
    numbers: (chain) => chain.toggleOrderedList(),
    quote: (chain) => chain.toggleBlockquote(),
    table: (chain) =>
      chain.insertTable({ cols: 2, rows: 2, withHeaderRow: true }),
    text: (chain) => chain.setParagraph(),
    "heading-1": (chain) => chain.setHeading({ level: 1 }),
    "heading-2": (chain) => chain.setHeading({ level: 2 }),
    "heading-3": (chain) => chain.setHeading({ level: 3 }),
  };

/**
 * Makes the block of the key in place of the slash query that opened the menu. The
 * range is the query itself, so it is removed first and the block takes its place.
 */
export function runSlash(key: SlashKey, editor: Editor, range: Range) {
  COMMANDS[key](editor.chain().focus().deleteRange(range)).run();
}

import type { NinaMemoryNote } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, pipe, String as Str } from "effect";

/** One memory as Nina and the capture call read it. */
type Note = typeof NinaMemoryNote.Type;

/**
 * Characters of one memory in the list a capture call reads. The call only has
 * to tell the memories apart, and a memory may hold 2000 characters.
 */
const KNOWN_LENGTH = 240;

const WHITESPACE = /\s+/gu;

/**
 * Words on one line, so they can never open a new section of a prompt, and
 * with their angle brackets written as entities, so they can never close the
 * block they sit in.
 */
export function oneLine(text: string) {
  return pipe(
    text,
    Str.replaceAll("<", "&lt;"),
    Str.replaceAll(">", "&gt;"),
    Str.replaceAll(WHITESPACE, " "),
    Str.trim
  );
}

/** The kind in front of a memory's words, when Nina gave it one. */
function label(kind: Note["kind"]) {
  return kind === undefined ? "" : `(${kind}) `;
}

/** A memory's title and its words on one line: `Sekolah: Kelas 12`, or the one it has. */
function wordsOf({ text, title }: Pick<Note, "text" | "title">) {
  return Arr.join(
    Arr.filter([oneLine(title ?? ""), oneLine(text)], Str.isNonEmpty),
    ": "
  );
}

/**
 * The first `length` characters of a line, followed by `...` when it is longer.
 * It counts and cuts by code point, so a cut never leaves half of an emoji in
 * the prompt.
 */
function shorten(line: string, length: number) {
  const characters = Arr.fromIterable(line);
  return Arr.length(characters) > length
    ? `${Arr.join(Arr.take(characters, length), "")}...`
    : line;
}

/**
 * A memory's title and words on one line, cut to `length` characters, with no
 * kind and no id: `Sekolah: Kelas 12`. This is how a prompt that names no memory
 * writes one, such as the build of a portrait, the memories a turn recalls and
 * the answer of the memory capability.
 */
export function textLine(note: Pick<Note, "text" | "title">, length: number) {
  return shorten(wordsOf(note), length);
}

/**
 * One memory as the capture call reads it, with the place it can name, counted
 * from 1 in the list: `- [1] (level) Kelas 12`. A long memory shows its first
 * `KNOWN_LENGTH` characters.
 */
export function knownLine(
  note: Pick<Note, "kind" | "text" | "title">,
  place: number
) {
  return `- [${place}] ${label(note.kind)}${textLine(note, KNOWN_LENGTH)}`;
}

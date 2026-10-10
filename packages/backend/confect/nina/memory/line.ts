import type { NinaLearner } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, String as Str } from "effect";

/** One memory as Nina and the capture call read it. */
export type Note = (typeof NinaLearner.Type)["known"][number];

/**
 * Characters of one memory in the list a capture call reads. The call only has
 * to tell the memories apart, and the learner can keep a hundred long ones.
 */
const KNOWN_LENGTH = 240;

const WHITESPACE = /\s+/gu;

/** Words on one line, so they can never open a new section of a prompt. */
function oneLine(text: string) {
  return Str.trim(Str.replaceAll(WHITESPACE, " ")(text));
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

/** One memory as Nina reads it: `- (level) Kelas 12`, or `- Kelas 12` for one the learner wrote. */
export function memoryLine(note: Pick<Note, "kind" | "text" | "title">) {
  return `- ${label(note.kind)}${wordsOf(note)}`;
}

/**
 * One memory as the capture call reads it, with the id it can name:
 * `- [id] (level) Kelas 12`. A long memory shows its first `KNOWN_LENGTH`
 * characters.
 */
export function knownLine(note: Pick<Note, "id" | "kind" | "text" | "title">) {
  const words = wordsOf(note);
  const shown =
    Str.length(words) > KNOWN_LENGTH
      ? `${Str.takeLeft(words, KNOWN_LENGTH)}...`
      : words;
  return `- [${note.id}] ${label(note.kind)}${shown}`;
}

import type { NinaLearner } from "@repo/backend/confect/nina/memory.spec";
import { String as Str } from "effect";

/** One memory as Nina and the capture call read it. */
export type Note = (typeof NinaLearner.Type)["known"][number];

const WHITESPACE = /\s+/gu;

/** A memory's words on one line, so they can never open a new section of a prompt. */
function oneLine(text: string) {
  return Str.trim(Str.replaceAll(WHITESPACE, " ")(text));
}

/** The kind in front of a memory's words, when Nina gave it one. */
function label(kind: Note["kind"]) {
  return kind === undefined ? "" : `(${kind}) `;
}

/** One memory as Nina reads it: `- (level) Kelas 12`, or `- Kelas 12` for one the learner wrote. */
export function memoryLine({ kind, text }: Pick<Note, "kind" | "text">) {
  return `- ${label(kind)}${oneLine(text)}`;
}

/** One memory as the capture call reads it, with the id it can name: `- [id] (level) Kelas 12`. */
export function knownLine({
  id,
  kind,
  text,
}: Pick<Note, "id" | "kind" | "text">) {
  return `- [${id}] ${label(kind)}${oneLine(text)}`;
}

import type { NinaLearner } from "@repo/backend/confect/nina/memory.spec";
import { String as Str } from "effect";

/** One memory as Nina and the capture call read it. */
export type Note = (typeof NinaLearner.Type)["known"][number];

const WHITESPACE = /\s+/gu;

/** A memory's words on one line, so they can never open a new section of a prompt. */
function oneLine(text: string) {
  return Str.trim(Str.replaceAll(WHITESPACE, " ")(text));
}

/** One memory as Nina reads it: `- (level) Kelas 12`. */
export function memoryLine({ kind, text }: Pick<Note, "kind" | "text">) {
  return `- (${kind}) ${oneLine(text)}`;
}

/** One memory as the capture call reads it, with the id it can name: `- [id] (level) Kelas 12`. */
export function knownLine({
  id,
  kind,
  text,
}: Pick<Note, "id" | "kind" | "text">) {
  return `- [${id}] (${kind}) ${oneLine(text)}`;
}

import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { QuestionGrade } from "@repo/backend/confect/assessment/parts";
import {
  findPart,
  isPartsResponse,
  QuestionResponse,
} from "@repo/backend/confect/assessment/parts";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Array as Arr, MutableRef, Option, Schema } from "effect";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

/**
 * The response of a question of several parts once one part holds `next`, beside what its other parts hold, or
 * none once no part holds an answer, which clears the question. A part left blank (`null`) holds nothing.
 */
export function withPart(
  response: QuestionResponse | null,
  interaction: string,
  next: ExamResponse | null
): QuestionResponse | null {
  const parts =
    response !== null && isPartsResponse(response) ? response.parts : [];
  const others = Arr.filter(parts, (part) => part.interaction !== interaction);
  const all =
    next === null
      ? others
      : Arr.append(others, { interaction, response: next });
  return Arr.isReadonlyArrayNonEmpty(all) ? { parts: all } : null;
}

/** What one part of a question holds, or none while it is blank. */
export const partOf = (
  response: QuestionResponse | null,
  interaction: string
): ExamResponse | null =>
  response === null ? null : Option.getOrNull(findPart(response, interaction));

/**
 * The response of a question of one interaction. The server stores a response to that interaction alone, so a
 * response of parts never reaches it, and reads as none.
 */
export const onlyResponse = (
  response: QuestionResponse | null
): ExamResponse | null =>
  response === null || isPartsResponse(response) ? null : response;

/** One write of a question of several parts: the response it sends, and the version it is numbered. */
const PartsWrite = Schema.Struct({
  response: Schema.NullOr(QuestionResponse),
  version: Schema.Finite,
});
type PartsWrite = typeof PartsWrite.Type;

/**
 * The write of a question of several parts once one part changes. Two parts can save in the same moment, as a page
 * that hides sends the waiting text of every field at once, before the question shows the first of them. So while
 * the question shows a version older than the page's own last write (`last`), the write builds on that write and is
 * numbered one above it, and neither write takes the other's place. Once the question shows a version as new, from
 * this page or another tab, the write builds on what the question holds.
 */
export function nextPartsWrite(
  question: Pick<TryoutRuntimeQuestion, "response" | "version">,
  last: Option.Option<PartsWrite>,
  interaction: string,
  next: ExamResponse | null
): PartsWrite {
  const shown: PartsWrite = {
    response: question.response?.response ?? null,
    version: question.version ?? 0,
  };
  const base = Option.getOrElse(
    Option.filter(last, (write) => write.version > shown.version),
    () => shown
  );
  return {
    response: withPart(base.response, interaction, next),
    version: base.version + 1,
  };
}

/**
 * The writes of one question of several parts on one page, each built on the last (`nextPartsWrite`). The page
 * makes it once per question and calls it as a part saves.
 */
export function makePartsWriter() {
  const last = MutableRef.make(Option.none<PartsWrite>());
  return (
    question: Pick<TryoutRuntimeQuestion, "response" | "version">,
    interaction: string,
    next: ExamResponse | null
  ) => {
    const write = nextPartsWrite(
      question,
      MutableRef.get(last),
      interaction,
      next
    );
    MutableRef.set(last, Option.some(write));
    return write;
  };
}

/**
 * Each part of a reviewed question of several, in the item's order: its interaction, the key's answer for it and
 * its grade when the reader may see them, and what the learner gave it.
 */
export function reviewedParts({
  grade,
  interactions,
  keys,
  response,
}: {
  readonly grade: QuestionGrade | undefined;
  readonly interactions: readonly Interaction[];
  readonly keys: readonly InteractionKey[] | undefined;
  readonly response: QuestionResponse | null;
}) {
  return Arr.map(interactions, (interaction) => ({
    grade: Option.map(
      Arr.findFirst(
        grade?.parts ?? [],
        (part) => part.interaction === interaction.id
      ),
      (part) => part.grade
    ),
    interaction,
    key: Arr.findFirst(keys ?? [], (key) => key.interaction === interaction.id),
    response: partOf(response, interaction.id),
  }));
}

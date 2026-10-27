import type { Selection } from "@repo/backend/confect/response/model";
import { Array as Arr, HashMap, Option } from "effect";
import { pickOption } from "@/components/player/keyboard";
import type { PlayerQuestionModel } from "@/components/player/model";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

/**
 * Projects the questions of a running section into what the player marks in
 * its navigator, flags, and picks from the keyboard. Each question answers
 * through the same save that its response fields use, and flags through the
 * flag save, which turns its flag the other way.
 */
export function projectTryoutQuestions(input: {
  answer: (
    question: TryoutRuntimeQuestion,
    selection: Selection | null
  ) => void;
  flag: (question: TryoutRuntimeQuestion, flagged: boolean) => void;
  questions: readonly TryoutRuntimeQuestion[];
}): readonly PlayerQuestionModel[] {
  return Arr.map(input.questions, (question) => ({
    answered: question.response?.isComplete ?? false,
    flag: () => input.flag(question, !question.flagged),
    flagged: question.flagged,
    key: question.placementId,
    pick: (index) =>
      Option.match(pickOption(question.responseSpec, index), {
        onNone: () => false,
        onSome: (selection) => {
          input.answer(question, selection);
          return true;
        },
      }),
  }));
}

/** Builds the stable content identity captured when the attempt was created. */
function getContentKey(identity: {
  contentHash: string;
  sourcePath: string;
  sourceRevision: string;
}) {
  return `${identity.sourcePath}:${identity.contentHash}:${identity.sourceRevision}`;
}

/**
 * Pairs each running question with the signed body frozen for it at attempt
 * start, in the order of the questions. It finds none when any question has no
 * body, which a stale prefetch of the content can cause, because a section
 * that shows some of its questions is wrong.
 */
export function joinTryoutBodies<Body>(input: {
  bodies: readonly {
    content: Body;
    contentHash: string;
    sourcePath: string;
    sourceRevision: string;
  }[];
  questions: readonly TryoutRuntimeQuestion[];
}) {
  const bodies = HashMap.fromIterable(
    Arr.map(input.bodies, (body) => [getContentKey(body), body.content])
  );
  const joined = Arr.getSomes(
    Arr.map(input.questions, (question) =>
      Option.map(HashMap.get(bodies, getContentKey(question)), (body) => ({
        body,
        question,
      }))
    )
  );
  return joined.length === input.questions.length
    ? Option.some(joined)
    : Option.none();
}

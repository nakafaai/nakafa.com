import type { Ref } from "@confect/core";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  chosenOptions,
  type ExamResponse,
  isAnswered,
  markedCells,
} from "@repo/backend/confect/assessment/response";
import { Array as Arr, Number as Num, Option, Struct } from "effect";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

type SaveResponseArgs = Ref.Args<typeof tryouts.mutations.responses.save>;

/** Whether a question holds an answer the server counts: a response that answers something. */
export function isAnsweredQuestion(question: TryoutRuntimeQuestion) {
  return question.response !== null && isAnswered(question.response.response);
}

/**
 * Whether a response gives exactly the key's answer: a choice holds the key's options and no other, and
 * a matrix marks every statement in the key's column. A key of a kind the corpus does not compile
 * matches nothing.
 */
export function matchesKey(answer: InteractionKey, response: ExamResponse) {
  if (answer.kind === "choice") {
    const chosen = chosenOptions(response);
    return (
      chosen.length === answer.correct.length &&
      Arr.every(answer.correct, (id) => Arr.contains(chosen, id))
    );
  }
  if (answer.kind === "matrix") {
    const cells = markedCells(response);
    return (
      cells.length === answer.answers.length &&
      Arr.every(answer.answers, (key) =>
        Arr.some(
          cells,
          (cell) =>
            cell.statement === key.statement && cell.column === key.column
        )
      )
    );
  }
  return false;
}

/**
 * Returns the version of the next write of one question: the first for a
 * question without a versioned write, otherwise the one after the version it
 * shows, which is the server's version of the latest write (a cleared answer
 * keeps it) or the optimistic one of the latest write that is still on its way.
 * Convex keeps both in the same cached query, so the number survives a
 * re-render, and a reload starts from the server's version.
 */
export function nextTryoutResponseVersion(question: TryoutRuntimeQuestion) {
  return (question.version ?? 0) + 1;
}

/**
 * Tells what a failed save means for the page. A stale refusal needs nothing:
 * a newer write took its place, Convex dropped the optimistic answer with the
 * failed mutation, and the screen shows the server's answer again. An attempt
 * or section that ended gets a notice, and anything else is a fault to report.
 */
export function tryoutSubmitFailureOf(
  code: Ref.Error<typeof tryouts.mutations.responses.save>["code"] | undefined
) {
  if (code === "TRYOUT_RESPONSE_STALE") {
    return "stale";
  }
  if (
    code === "TRYOUT_EXPIRED" ||
    code === "TRYOUT_ATTEMPT_NOT_ACTIVE" ||
    code === "TRYOUT_SECTION_NOT_ACTIVE"
  ) {
    return "ended";
  }
  return "error";
}

/**
 * Applies one local response while Convex remains authoritative for time. The
 * answered count moves as the server counts it (`isAnswered`), so a response
 * that answers nothing, such as a cleared multiple choice, counts as none. A
 * response for a question the section does not hold changes nothing, as the
 * flag's change does (`updateRuntimeQueries`).
 */
export function applyOptimisticTryoutResponse(
  runtime: TryoutSectionRuntime,
  args: SaveResponseArgs,
  selectedAt: number
): TryoutSectionRuntime | null {
  const changed = Option.map(
    Arr.findFirst(
      runtime.questions,
      (question) => question.placementId === args.placementId
    ),
    (current) => {
      const answered = Number(
        args.response !== null && isAnswered(args.response)
      );
      return {
        ...runtime,
        questions: Arr.map(runtime.questions, (question) =>
          question.placementId === args.placementId
            ? withResponse(question, args, selectedAt)
            : question
        ),
        section: {
          ...runtime.section,
          answeredCount: Num.clamp(
            runtime.section.answeredCount +
              answered -
              Number(isAnsweredQuestion(current)),
            { maximum: runtime.section.totalQuestions, minimum: 0 }
          ),
        },
      };
    }
  );
  return Option.getOrNull(changed);
}

/** One question after a local write: its new version, and the response, keeping when it was first answered. */
function withResponse(
  question: TryoutRuntimeQuestion,
  args: SaveResponseArgs,
  selectedAt: number
): TryoutRuntimeQuestion {
  return {
    ...question,
    ...Struct.pick(args, ["version"]),
    response:
      args.response === null
        ? null
        : responseAt(question, args.response, selectedAt),
  };
}

/** The stored shape of a local response chosen at `selectedAt`. */
function responseAt(
  question: TryoutRuntimeQuestion,
  response: ExamResponse,
  selectedAt: number
) {
  return {
    answeredAt: question.response?.answeredAt ?? selectedAt,
    response,
    updatedAt: selectedAt,
  };
}

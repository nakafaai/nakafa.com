import {
  hasDistinctIds,
  LocalIdSchema,
} from "@nakafa/aksara-contracts/assessment/identity";
import { fitsQuestion } from "@repo/backend/confect/assessment/fit";
import { Grade } from "@repo/backend/confect/assessment/grade";
import {
  ExamResponse,
  isAnswered,
} from "@repo/backend/confect/assessment/response";
import type { GradedInteraction } from "@repo/backend/confect/assessment/structure";
import { Array as Arr, Number as Num, Option, Schema, Tuple } from "effect";

/**
 * The most interactions one question holds: the parts of an exam task, or the gaps of a C-Test, which counts
 * about twenty-five. The bound keeps a question's response and grade one small row.
 */
export const QUESTION_PARTS_MAX = 64;

/** The response to one part of a question: the interaction it answers and what the learner gave it. */
const PartResponse = Schema.Struct({
  interaction: LocalIdSchema,
  response: ExamResponse,
});

/**
 * The response to a question of several interactions, such as the parts (Teilaufgaben) of an exam task or
 * the gaps of a C-Test: the response to each part the learner answered, once. A part left blank holds none.
 */
const PartsResponse = Schema.Struct({
  parts: Schema.NonEmptyArray(PartResponse).check(
    Schema.isMaxLength(QUESTION_PARTS_MAX)
  ),
});

/**
 * The response to one question: the response to its one interaction (`ExamResponse`), or, for a question of
 * several, the response to each of its parts (`PartsResponse`). The two never share a field, so a stored
 * response reads as one or the other.
 */
export const QuestionResponse = Schema.Union([ExamResponse, PartsResponse]);
export type QuestionResponse = typeof QuestionResponse.Type;

/** Whether a response holds the parts of a question of several interactions. */
export const isPartsResponse = Schema.is(PartsResponse);

/** The response one part of a question holds: what the learner gave it, or none while it stays blank. */
export const findPart = (
  response: QuestionResponse,
  interaction: string
): Option.Option<ExamResponse> =>
  isPartsResponse(response)
    ? Option.map(
        Arr.findFirst(
          response.parts,
          (part) => part.interaction === interaction
        ),
        (part) => part.response
      )
    : Option.none();

/** Whether a response answers its question: the answer to its one interaction, or any part of a question of several. */
export const answersQuestion = (response: QuestionResponse) =>
  isPartsResponse(response)
    ? Arr.some(response.parts, (part) => isAnswered(part.response))
    : isAnswered(response);

/**
 * Whether a response fits a question of several interactions: it names each part at most once, each part is one
 * of the question's interactions, and each part's response fits that interaction (`fitsQuestion`).
 */
export const fitsParts = (
  interactions: readonly GradedInteraction[],
  response: QuestionResponse
) =>
  isPartsResponse(response) &&
  hasDistinctIds(Arr.map(response.parts, (part) => part.interaction)) &&
  Arr.every(response.parts, (part) =>
    Option.match(
      Arr.findFirst(
        interactions,
        (interaction) => interaction.id === part.interaction
      ),
      {
        onNone: () => false,
        onSome: (interaction) => fitsQuestion([interaction], part.response),
      }
    )
  );

/** The grade of one part of a question: the interaction it grades, and how that part's own rule scored it. */
const PartGrade = Schema.Struct({ grade: Grade, interaction: LocalIdSchema });
type PartGrade = typeof PartGrade.Type;

/**
 * How one question grades: the grade of its one interaction, or, for a question of several, the sum of its
 * parts with each part's own grade in `parts`. The sum's ceiling is every part's ceiling, the question's most
 * points; it is scored with the points the parts earned once every part is scored, and pending while any part
 * waits for a grader.
 */
export const QuestionGrade = Grade.mapMembers(
  Tuple.map(
    Schema.fieldsAssign({
      parts: Schema.optionalKey(
        Schema.NonEmptyArray(PartGrade).check(
          Schema.isMaxLength(QUESTION_PARTS_MAX)
        )
      ),
    })
  )
);
export type QuestionGrade = typeof QuestionGrade.Type;

/** The points one grade earned: its category once scored, and none while it waits for a grader. */
const scoredPoints = (grade: Grade) =>
  grade.status === "scored" ? grade.category : 0;

/** Sums the grades of a question's parts into the question's grade (`QuestionGrade`). */
export function sumParts(
  parts: readonly [PartGrade, ...PartGrade[]]
): QuestionGrade {
  const ceiling = Num.sumAll(Arr.map(parts, ({ grade }) => grade.ceiling));
  if (Arr.some(parts, ({ grade }) => grade.status === "pending")) {
    return { ceiling, parts, status: "pending" };
  }
  return {
    category: Num.sumAll(Arr.map(parts, ({ grade }) => scoredPoints(grade))),
    ceiling,
    parts,
    status: "scored",
  };
}

/**
 * The points a question has earned so far: its category once scored, and while a part of a question of several
 * waits for a grader, what its scored parts earned. A question of one interaction that waits has earned none.
 */
export const earnedPoints = (grade: QuestionGrade) =>
  grade.status === "scored"
    ? grade.category
    : Num.sumAll(
        Arr.map(grade.parts ?? [], (part) => scoredPoints(part.grade))
      );

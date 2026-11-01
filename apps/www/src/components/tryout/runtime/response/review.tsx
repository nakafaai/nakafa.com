import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  chosenOptions,
  type ExamResponse,
  markedCells,
} from "@repo/backend/confect/assessment/response";
import {
  optionDirection,
  optionLetters,
} from "@repo/backend/confect/exams/letters";
import { Array as Arr, Option } from "effect";
import { TryoutReviewedChoice } from "@/components/tryout/runtime/choice/surface";
import { TryoutChoiceTable } from "@/components/tryout/runtime/choice/table";
import { optionLabelId } from "@/components/tryout/runtime/response/id";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label";

/**
 * Renders the one interaction of a reviewed question with its key: each option marked correct or not,
 * and each statement of a matrix with the key's column and a mark that misses it.
 */
export function TryoutReviewedFields({
  answer,
  id,
  interaction,
  response,
}: {
  /** The key's answer for the interaction. */
  readonly answer: InteractionKey;
  readonly id: string;
  readonly interaction: Interaction;
  readonly response: ExamResponse | null;
}) {
  if (interaction.kind === "matrix" && answer.kind === "matrix") {
    const cells = markedCells(response ?? []);
    return (
      <TryoutChoiceTable
        columns={Arr.map(interaction.columns, (column) => ({
          id: column.id,
          label: <TryoutResponseLabel document={column.label} />,
        }))}
        disabled
        statements={Arr.map(interaction.statements, (statement) => ({
          correct: Option.getOrUndefined(
            Option.map(
              Arr.findFirst(
                answer.answers,
                (cell) => cell.statement === statement.id
              ),
              (cell) => cell.column
            )
          ),
          id: statement.id,
          label: <TryoutResponseLabel document={statement.label} />,
          marked: Option.getOrUndefined(
            Option.map(
              Arr.findFirst(cells, (cell) => cell.statement === statement.id),
              (cell) => cell.column
            )
          ),
        }))}
      />
    );
  }
  if (interaction.kind !== "choice" || answer.kind !== "choice") {
    return null;
  }
  const chosen = chosenOptions(response ?? []);
  const labels = Arr.map(interaction.options, (option) => option.label);
  const letterOf = optionLetters(labels);
  return (
    <div
      className="grid grid-cols-1 gap-2 md:grid-cols-2"
      dir={optionDirection(labels)}
    >
      {Arr.map(interaction.options, (option, index) => {
        const isCorrect = Arr.contains(answer.correct, option.id);
        return (
          <TryoutReviewedChoice
            checked={Arr.contains(chosen, option.id)}
            id={optionLabelId(id, option.id)}
            isCorrect={isCorrect}
            key={option.id}
            letter={letterOf(index)}
          >
            <TryoutResponseLabel
              correctness={isCorrect}
              document={option.label}
            />
          </TryoutReviewedChoice>
        );
      })}
    </div>
  );
}

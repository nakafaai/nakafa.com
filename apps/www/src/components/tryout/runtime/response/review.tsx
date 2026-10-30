import { Array as Arr, HashMap, HashSet, Option } from "effect";
import { TryoutReviewedChoice } from "@/components/tryout/runtime/choice/surface";
import { TryoutChoiceTable } from "@/components/tryout/runtime/choice/table";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";
import type { TryoutRenderableResponseSpec } from "@/components/tryout/runtime/types";

/** Renders one immutable response with answer-key review styling. */
export function TryoutReviewedResponse({
  questionOrder,
  responseSpec,
  selection,
}: {
  readonly questionOrder: number;
  readonly responseSpec: TryoutRenderableResponseSpec;
  readonly selection: TryoutResponseSelection | null;
}) {
  if (responseSpec.kind === "category") {
    return (
      <ReviewedCategoryResponse
        questionOrder={questionOrder}
        responseSpec={responseSpec}
        selection={selection}
      />
    );
  }
  if (responseSpec.kind === "short-answer" || responseSpec.kind === "rubric") {
    return null;
  }
  const selected = HashSet.fromIterable(readSelectedOptionKeys(selection));
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {Arr.map(responseSpec.options, (option) => (
        <TryoutReviewedChoice
          checked={HashSet.has(selected, option.optionKey)}
          id={`review-question-${questionOrder}-${option.optionKey}`}
          isCorrect={option.isCorrect}
          key={option.optionKey}
          label={
            <TryoutResponseLabel
              correctness={option.isCorrect}
              id={`review-question-${questionOrder}-${option.optionKey}`}
            >
              {option.label}
            </TryoutResponseLabel>
          }
        />
      ))}
    </div>
  );
}

function readSelectedOptionKeys(selection: TryoutResponseSelection | null) {
  if (selection?.kind === "single-choice") {
    return [selection.optionKey];
  }
  if (selection?.kind === "multiple-choice") {
    return selection.optionKeys;
  }
  return [];
}

function ReviewedCategoryResponse({
  questionOrder,
  responseSpec,
  selection,
}: {
  readonly questionOrder: number;
  readonly responseSpec: Extract<
    TryoutRenderableResponseSpec,
    { kind: "category" }
  >;
  readonly selection: TryoutResponseSelection | null;
}) {
  const assigned = HashMap.fromIterable(
    selection?.kind === "category"
      ? Arr.map(selection.assignments, (assignment) => [
          assignment.statementKey,
          assignment.categoryKey,
        ])
      : []
  );
  const id = `review-question-${questionOrder}`;
  return (
    <TryoutChoiceTable
      columns={Arr.map(responseSpec.categories, (category) => ({
        id: category.categoryKey,
        label: (
          <TryoutResponseLabel id={`${id}-category-${category.categoryKey}`}>
            {category.label}
          </TryoutResponseLabel>
        ),
      }))}
      disabled
      statements={Arr.map(responseSpec.statements, (statement) => ({
        correct: statement.correctCategoryKey,
        id: statement.statementKey,
        label: (
          <TryoutResponseLabel id={`${id}-${statement.statementKey}`}>
            {statement.label}
          </TryoutResponseLabel>
        ),
        marked: Option.getOrUndefined(
          HashMap.get(assigned, statement.statementKey)
        ),
      }))}
    />
  );
}

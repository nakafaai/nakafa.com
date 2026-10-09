import { Array as Arr, HashMap, HashSet, Option } from "effect";
import { TryoutReviewedChoice } from "@/components/tryout/runtime/choice/surface.client";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label.client";
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
  return (
    <div className="space-y-6">
      {Arr.map(responseSpec.statements, (statement) => {
        const statementId = `review-question-${questionOrder}-${statement.statementKey}`;
        const statementLabelId = `${statementId}-label`;
        const assignedCategory = Option.getOrUndefined(
          HashMap.get(assigned, statement.statementKey)
        );
        return (
          <section className="space-y-3" key={statement.statementKey}>
            <div id={statementLabelId}>
              <TryoutResponseLabel id={statementId}>
                {statement.label}
              </TryoutResponseLabel>
            </div>
            <fieldset
              aria-labelledby={statementLabelId}
              className="m-0 grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2"
            >
              {Arr.map(responseSpec.categories, (category) => (
                <TryoutReviewedChoice
                  checked={assignedCategory === category.categoryKey}
                  id={`${statementId}-${category.categoryKey}`}
                  isCorrect={
                    statement.correctCategoryKey === undefined
                      ? undefined
                      : statement.correctCategoryKey === category.categoryKey
                  }
                  key={category.categoryKey}
                  label={
                    <TryoutResponseLabel
                      correctness={
                        statement.correctCategoryKey === undefined
                          ? undefined
                          : statement.correctCategoryKey ===
                            category.categoryKey
                      }
                      id={`${statementId}-${category.categoryKey}`}
                    >
                      {category.label}
                    </TryoutResponseLabel>
                  }
                />
              ))}
            </fieldset>
          </section>
        );
      })}
    </div>
  );
}

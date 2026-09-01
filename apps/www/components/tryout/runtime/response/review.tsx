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
  const selected = new Set(readSelectedOptionKeys(selection));
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {responseSpec.options.map((option) => (
        <TryoutReviewedChoice
          checked={selected.has(option.optionKey)}
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
  const assigned = new Map(
    selection?.kind === "category"
      ? selection.assignments.map((assignment) => [
          assignment.statementKey,
          assignment.categoryKey,
        ])
      : []
  );
  return (
    <div className="space-y-6">
      {responseSpec.statements.map((statement) => (
        <section className="space-y-3" key={statement.statementKey}>
          <TryoutResponseLabel
            id={`review-question-${questionOrder}-${statement.statementKey}`}
          >
            {statement.label}
          </TryoutResponseLabel>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {responseSpec.categories.map((category) => (
              <TryoutReviewedChoice
                checked={
                  assigned.get(statement.statementKey) === category.categoryKey
                }
                id={`review-question-${questionOrder}-${statement.statementKey}-${category.categoryKey}`}
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
                        : statement.correctCategoryKey === category.categoryKey
                    }
                    id={`review-question-${questionOrder}-${statement.statementKey}-${category.categoryKey}`}
                  >
                    {category.label}
                  </TryoutResponseLabel>
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

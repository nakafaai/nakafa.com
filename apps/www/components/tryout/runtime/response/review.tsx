import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import { TryoutReviewedChoice } from "@/components/tryout/runtime/choice/surface.client";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeResponseSpec } from "@/components/tryout/runtime/types";

/** Renders one immutable response with answer-key review styling. */
export function TryoutReviewedResponse({
  questionOrder,
  responseSpec,
  selection,
}: {
  readonly questionOrder: number;
  readonly responseSpec: TryoutRuntimeResponseSpec;
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
            <MarkdownContent
              className="wrap-anywhere h-auto whitespace-normal"
              id={`review-question-${questionOrder}-${option.optionKey}-label-content`}
            >
              {option.label}
            </MarkdownContent>
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
    TryoutRuntimeResponseSpec,
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
          <MarkdownContent
            className="wrap-anywhere h-auto whitespace-normal"
            id={`review-question-${questionOrder}-${statement.statementKey}-label-content`}
          >
            {statement.label}
          </MarkdownContent>
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
                  <MarkdownContent
                    className="wrap-anywhere h-auto whitespace-normal"
                    id={`review-question-${questionOrder}-${statement.statementKey}-${category.categoryKey}-label-content`}
                  >
                    {category.label}
                  </MarkdownContent>
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

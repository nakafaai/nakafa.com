import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import { spokenText } from "@repo/design-system/lib/markdown/spoken";
import { Array as Arr, Record as Rec } from "effect";
import { Fragment, type ReactNode } from "react";
import {
  categoryLabelId,
  optionLabelId,
  statementLabelId,
} from "@/components/tryout/runtime/response/id";

type LabelEntry = readonly [id: string, label: string];

/**
 * Renders authored response labels on the server before client interaction. A label names its control by
 * its own words: the drawn label is hidden from assistive technology, and its words, each formula spoken
 * as KaTeX reads it (`spokenText`), stand beside it for screen readers. A label drawn only as math would
 * otherwise name nothing, since its formula is MathML, which an accessible name does not read.
 */
export function renderTryoutResponseLabels(
  responseId: string,
  response: QuestionResponse
): Readonly<Record<string, ReactNode>> {
  return Rec.fromEntries(
    Arr.map(readLabelEntries(responseId, response), ([id, label]) => [
      id,
      <Fragment key={id}>
        <div aria-hidden="true">
          <MarkdownContent
            className="h-auto wrap-anywhere whitespace-normal"
            id={`${id}-label-content`}
          >
            {label}
          </MarkdownContent>
        </div>
        <span className="sr-only">{spokenText(label)}</span>
      </Fragment>,
    ])
  );
}

/** Lists the option, statement, and category labels the fields render. */
function readLabelEntries(
  responseId: string,
  response: QuestionResponse
): readonly LabelEntry[] {
  if (response.kind === "category") {
    return [
      ...Arr.map(
        response.statements,
        (statement) =>
          [
            statementLabelId(responseId, statement.statementKey),
            statement.label,
          ] as const
      ),
      ...Arr.map(
        response.categories,
        (category) =>
          [
            categoryLabelId(responseId, category.categoryKey),
            category.label,
          ] as const
      ),
    ];
  }
  if (response.kind === "short-answer" || response.kind === "rubric") {
    return [];
  }
  return Arr.map(
    response.options,
    (option) =>
      [optionLabelId(responseId, option.optionKey), option.label] as const
  );
}

import "server-only";

import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import type { ReactNode } from "react";
import {
  categoryLabelId,
  optionLabelId,
  statementLabelId,
} from "@/components/tryout/runtime/response/id";

type LabelEntry = readonly [id: string, label: string];

/** Renders authored response labels on the server before client interaction. */
export function renderTryoutResponseLabels(
  responseId: string,
  response: QuestionResponse
): Readonly<Record<string, ReactNode>> {
  const entries: readonly LabelEntry[] =
    response.kind === "category"
      ? response.statements.flatMap((statement) => [
          [
            statementLabelId(responseId, statement.statementKey),
            statement.label,
          ] as const,
          ...response.categories.map(
            (category) =>
              [
                categoryLabelId(
                  responseId,
                  statement.statementKey,
                  category.categoryKey
                ),
                category.label,
              ] as const
          ),
        ])
      : response.options.map(
          (option) =>
            [optionLabelId(responseId, option.optionKey), option.label] as const
        );

  return Object.fromEntries(
    entries.map(([id, label]) => [
      id,
      <MarkdownContent
        className="wrap-anywhere h-auto whitespace-normal"
        id={`${id}-label-content`}
        key={id}
      >
        {label}
      </MarkdownContent>,
    ])
  );
}

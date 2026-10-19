"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type {
  AnswerRow as AnswerRowSchema,
  QuestionSummary as QuestionSummarySchema,
} from "@repo/backend/confect/exams/results/contract";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import {
  correctShare,
  optionLetter,
  responseLetters,
  verdictKeys,
} from "@/components/exams/results/model";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";

/** The answers of one page of a question's list. The next page loads as the list's end comes into view. */
const ANSWER_PAGE_SIZE = 50;

type Question = typeof QuestionSummarySchema.Type;
type AnswerRow = typeof AnswerRowSchema.Type;

/**
 * The statistics of one question and its answers, with the chosen options of each student. The
 * statistics read the sitting's answers in one bounded read and say when that read is partial.
 */
function QuestionPanel({ question }: { readonly question: Question }) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const key = settled ? { questionId: question.id, sittingId, slug } : "skip";
  const stats = useQuery(exams.results.results.questionStats, key);
  const answers = usePaginatedQuery(exams.results.results.byQuestion, key, {
    initialNumItems: ANSWER_PAGE_SIZE,
  });

  if (QueryResult.isFailure(stats) || PaginatedQueryResult.isFailure(answers)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("results-unavailable")}
      </p>
    );
  }
  if (
    !QueryResult.isSuccess(stats) ||
    PaginatedQueryResult.isLoadingFirstPage(answers)
  ) {
    return null;
  }
  const share = correctShare(stats.value);
  return (
    <>
      <CardSection>
        <CardHeader>
          <CardTitle>{t("question", { number: question.number })}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>
            {share === null
              ? t("results-no-answers")
              : t("results-share", { share })}
          </p>
          <ul className="grid gap-2">
            {Arr.map(stats.value.optionCounts, (option, index) => (
              <li className="flex justify-between gap-4" key={option.optionId}>
                <span>{t("option", { letter: optionLetter(index) })}</span>
                <span className="tabular-nums">{option.count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardSectionFooter
          hint={
            stats.value.complete
              ? t("results-counted", { counted: stats.value.counted })
              : t("results-incomplete", { counted: stats.value.counted })
          }
        />
      </CardSection>
      <AnswerList
        loadMore={
          PaginatedQueryResult.isCanLoadMore(answers)
            ? () => answers.loadMore(ANSWER_PAGE_SIZE)
            : null
        }
        optionIds={question.optionIds}
        results={answers.results}
      />
    </>
  );
}

/** The answers of a question, one student each, with the letters they chose and the verdict. */
function AnswerList({
  loadMore,
  optionIds,
  results,
}: {
  /** Loads the next page, or `null` once the list holds every answer. */
  readonly loadMore: (() => void) | null;
  readonly optionIds: readonly string[];
  readonly results: readonly AnswerRow[];
}) {
  const t = useTranslations("Exams");

  if (results.length === 0) {
    return (
      <TableEmpty
        act="reading"
        description={t("results-no-answers")}
        title={t("results-answers")}
      />
    );
  }
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("results-name")}</TableHead>
            <TableHead>{t("results-answers")}</TableHead>
            <TableHead>{t("results-status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(results, (answer) => (
            <TableRow key={answer.attemptId}>
              <TableCell>{answer.name}</TableCell>
              <TableCell>
                {Arr.join(responseLetters(optionIds, answer.response), ", ")}
              </TableCell>
              <TableCell>{t(verdictKeys[answer.verdict])}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {loadMore === null ? null : <Intersection onIntersect={loadMore} />}
    </TableFrame>
  );
}

/**
 * The questions of the exam, one at a time: a question's button selects it, and its statistics and
 * answers show below. The selection lives in this component, so nothing above it is re-rendered.
 */
export function QuestionResults({
  questions,
}: {
  readonly questions: readonly Question[];
}) {
  const t = useTranslations("Exams");
  const [selected, setSelected] = useState(0);
  const current = Arr.get(questions, selected);

  return (
    <div className="grid gap-4">
      <h2 className="font-medium text-base">{t("questions")}</h2>
      <div className="flex flex-wrap gap-2">
        {Arr.map(questions, (question, index) => (
          <Button
            aria-pressed={index === selected}
            key={question.id}
            onClick={() => setSelected(index)}
            size="sm"
            type="button"
            variant={index === selected ? "secondary" : "outline"}
          >
            {t("question", { number: question.number })}
          </Button>
        ))}
      </div>
      {Option.match(current, {
        onNone: () => null,
        onSome: (question) => (
          <QuestionPanel key={question.id} question={question} />
        ),
      })}
    </div>
  );
}

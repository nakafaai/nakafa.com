import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  CancelCircleIcon,
  ChartHistogramIcon,
  CheckmarkCircle02Icon,
  HourglassIcon,
  MinusSignCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type {
  AnswerRow as AnswerRowSchema,
  QuestionSummary as QuestionSummarySchema,
} from "@repo/backend/confect/exams/results/contract";
import { Verdict } from "@repo/backend/confect/exams/results/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option, Schema } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  useResultsPaper,
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { GradeField } from "@/components/exams/results/grade";
import {
  correctShare,
  optionLetter,
  responseText,
  verdictKeys,
} from "@/components/exams/results/model";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnChoice } from "@/components/shared/table/column";
import { chosenOne } from "@/components/shared/table/filter";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
  useServerSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { useKeptRows } from "@/lib/data/kept";

/** The look of each verdict of an answer: a check, a cross, a half mark and a wait, each in its tone. */
const VERDICT_LOOKS = {
  correct: { icon: CheckmarkCircle02Icon, tone: "success" },
  incorrect: { icon: CancelCircleIcon, tone: "danger" },
  partial: { icon: MinusSignCircleIcon, tone: "warning" },
  pending: { icon: HourglassIcon, tone: "neutral" },
} as const satisfies Record<keyof typeof verdictKeys, StatusLook>;

/** The answers of one page of a question's list. The next page loads as the list's end comes into view. */
const ANSWER_PAGE_SIZE = 50;

type Question = typeof QuestionSummarySchema.Type;
type AnswerRow = typeof AnswerRowSchema.Type;

/** The verdict that a question's answers show: every answer, or only the answers of one verdict. */
const VerdictFilter = Schema.Union([Schema.Literal("all"), Verdict]);
type VerdictFilter = typeof VerdictFilter.Type;

/**
 * The statistics of one question and its answers, with the chosen options of each student. The
 * statistics read the sitting's answers in one bounded read and say when that read is partial. The
 * server reads the answers' filters: a verdict reads only the answers of that verdict, and a name
 * search reads the students whose names match it, best match first.
 */
function QuestionResults({ question }: { readonly question: Question }) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const search = useServerSearch();
  const chosen = useTableFilters((state) => state.chosen);
  const verdict = Option.getOrElse(
    chosenOne(chosen, "verdict", Schema.is(VerdictFilter)),
    (): VerdictFilter => "all"
  );
  const key = { questionId: question.id, sittingId, slug };
  const stats = useQuery(
    exams.results.results.questionStats,
    settled ? key : "skip"
  );
  const answers = usePaginatedQuery(
    exams.results.results.byQuestion,
    settled
      ? {
          ...key,
          ...(verdict === "all" ? {} : { verdict }),
          ...(search === "" ? {} : { search }),
        }
      : "skip",
    { initialNumItems: ANSWER_PAGE_SIZE }
  );
  // A new verdict's or search's first page loads behind the answers the list already shows, so it never blanks.
  const kept = useKeptRows(
    PaginatedQueryResult.isLoadingFirstPage(answers),
    answers.results
  );

  if (QueryResult.isFailure(stats)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("results-unavailable")}
      </p>
    );
  }
  if (!QueryResult.isSuccess(stats) || Option.isNone(kept)) {
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
      <div className="flex justify-end">
        <TableSearch placeholder={t("results-search")} />
      </div>
      {PaginatedQueryResult.isFailure(answers) ? (
        <DataFailure onRetry={reloadPage} />
      ) : null}
      <AnswerList
        exhausted={PaginatedQueryResult.isExhausted(answers)}
        filtering={verdict !== "all" || search !== ""}
        loadMore={
          PaginatedQueryResult.isCanLoadMore(answers)
            ? () => answers.loadMore(ANSWER_PAGE_SIZE)
            : null
        }
        question={question}
        results={kept.value}
      />
    </>
  );
}

/**
 * The values of the answers' status column, which chooses the answers the server reads: every answer,
 * or only the answers of one verdict. Each value carries the icon of its verdict.
 */
function useVerdictChoices() {
  const t = useTranslations("Exams");

  return [
    { icon: UserGroupIcon, label: t("filter-all"), value: "all" as const },
    ...Arr.map(Verdict.literals, (verdict) => ({
      icon: VERDICT_LOOKS[verdict].icon,
      label: t(verdictKeys[verdict]),
      value: verdict,
    })),
  ];
}

/**
 * The answers of a question, one student each, with the letters they chose or the text they wrote, the
 * points each earned, and the verdict. A viewer who grades the sitting gives each answer its points in
 * its row, as a teacher marks a stack of papers. While a filter narrows the list the table keeps its
 * head, so the verdict choice stays in reach, and the empty state waits for the list's last page.
 */
function AnswerList({
  exhausted,
  filtering,
  loadMore,
  question,
  results,
}: {
  /** Whether the list has no more pages, so an empty list is the end of it and not a wait. */
  readonly exhausted: boolean;
  readonly filtering: boolean;
  /** Loads the next page, or `null` once the list holds every answer. */
  readonly loadMore: (() => void) | null;
  readonly question: Question;
  readonly results: readonly AnswerRow[];
}) {
  const t = useTranslations("Exams");
  const { canGrade } = useResultsPaper();
  const verdictChoices = useVerdictChoices();

  if (results.length === 0 && !filtering) {
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
            <TableHead>{t("results-points")}</TableHead>
            <TableHead className="text-center">
              <ColumnChoice
                column="verdict"
                options={verdictChoices}
                title={t("results-status")}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(results, (answer) => (
            <TableRow key={answer.attemptId}>
              <TableCell>{answer.name}</TableCell>
              <TableCell>
                <span className="line-clamp-2 block max-w-96 whitespace-normal">
                  {responseText(question, answer.response)}
                </span>
              </TableCell>
              <TableCell className="tabular-nums">
                {canGrade ? (
                  <GradeField answer={answer} question={question} />
                ) : (
                  answer.points
                )}
              </TableCell>
              <TableCell className="text-center">
                <TableStatus
                  icon={VERDICT_LOOKS[answer.verdict].icon}
                  label={t(verdictKeys[answer.verdict])}
                  tone={VERDICT_LOOKS[answer.verdict].tone}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {exhausted && results.length === 0 ? (
        <TableEmpty
          act="reading"
          description={t("filter-empty")}
          title={t("results-no-match")}
        />
      ) : null}
      {loadMore === null ? null : <Intersection onIntersect={loadMore} />}
    </TableFrame>
  );
}

/**
 * Questions, in the results page's header row: it opens a sheet with the questions of the exam, one at a
 * time. A question's button selects it, and its statistics and answers show below. The selection lives
 * in this component, so nothing above it is re-rendered. On a phone the button keeps its icon, so the
 * page's name keeps its room.
 */
export function QuestionsAction({
  questions,
}: {
  readonly questions: readonly Question[];
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const [selected, setSelected] = useState(0);
  const current = Arr.get(questions, selected);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline">
            <HugeIcons icon={ChartHistogramIcon} />
            <span className="max-sm:sr-only">{t("questions")}</span>
          </Button>
        }
      />
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("questions")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-4">
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
              // Each question holds its own search and verdict filter, so a question opened next starts with every answer.
              onSome: (question) => (
                <TableFiltersProvider key={question.id}>
                  <QuestionResults question={question} />
                </TableFiltersProvider>
              ),
            })}
          </div>
        </ScrollArea>
        <SheetFooter>
          <SheetClose
            render={
              <Button type="button" variant="outline">
                {common("close")}
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CancelCircleIcon,
  ChartHistogramIcon,
  CheckmarkCircle02Icon,
  HourglassIcon,
  MinusSignCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  isReasonOption,
  optionLetter,
  optionPlace,
} from "@repo/backend/confect/exams/letters";
import type {
  AnswerRow as AnswerRowSchema,
  QuestionStats as QuestionStatsSchema,
  QuestionSummary as QuestionSummarySchema,
} from "@repo/backend/confect/exams/results/contract";
import { Verdict } from "@repo/backend/confect/exams/results/schema";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
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
  responseText,
  verdictKeys,
} from "@/components/exams/results/model";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { chosenOne } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { TableEnd } from "@/components/shared/table/pages";
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
  incorrect: { icon: CancelCircleIcon, tone: "destructive" },
  partial: { icon: MinusSignCircleIcon, tone: "warning" },
  pending: { icon: HourglassIcon, tone: "neutral" },
} as const satisfies Record<keyof typeof verdictKeys, StatusLook>;

/** The answers of one page of a question's list. The next page loads as the list's end comes into view. */
const ANSWER_PAGE_SIZE = 50;

type Question = typeof QuestionSummarySchema.Type;
type QuestionStats = typeof QuestionStatsSchema.Type;
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
function QuestionResults({
  question,
  waits,
}: {
  readonly question: Question;
  /** Whether the sheet is opening on this question, so it holds until the question has read. */
  readonly waits: boolean;
}) {
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
    return waits ? <PopupHold /> : null;
  }
  return (
    <>
      <QuestionCounts question={question} stats={stats.value} />
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

/** The share a question scored, how many answers that counts, the search over them, and each option's count. */
function QuestionCounts({
  question,
  stats,
}: {
  readonly question: Question;
  readonly stats: QuestionStats;
}) {
  const t = useTranslations("Exams");
  const share = correctShare(stats);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-medium">
            {share === null
              ? t("results-no-answers")
              : t("results-share", { share })}
          </p>
          <p className="text-muted-foreground">
            {stats.complete
              ? t("results-counted", { counted: stats.counted })
              : t("results-incomplete", { counted: stats.counted })}
          </p>
        </div>
        <TableSearch placeholder={t("results-search")} />
      </div>
      <ul className="flex flex-wrap gap-2">
        {Arr.map(stats.optionCounts, (option, index) => (
          <li key={option.optionId}>
            <Badge className="tabular-nums" variant="muted">
              {t(isReasonOption(option.optionId) ? "reason-option" : "option", {
                letter: optionLetter(
                  optionPlace(question.optionIds, index),
                  question.optionScript
                ),
              })}
              <span>{option.count}</span>
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The columns of a question's answers. */
const answerColumns = tableColumns<AnswerRow>();

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
    <div className="border-t [&_[data-slot=table-cell]]:whitespace-nowrap">
      <DataTable
        columns={[
          answerColumns.text((answer) => answer.name, {
            header: t("results-name"),
            id: "name",
          }),
          answerColumns.text(
            (answer) => responseText(question, answer.response),
            {
              cell: (info) => (
                <span
                  className="block min-w-56 wrap-break-word whitespace-pre-wrap"
                  dir="auto"
                >
                  {info.getValue()}
                </span>
              ),
              header: t("results-answers"),
              id: "response",
            }
          ),
          answerColumns.number((answer) => answer.points, {
            cell: (info) =>
              canGrade ? (
                <GradeField answer={info.row.original} question={question} />
              ) : (
                info.getValue()
              ),
            header: t("results-points"),
            id: "points",
          }),
          answerColumns.choice((answer) => answer.verdict, {
            cell: (info) => (
              <TableStatus
                icon={VERDICT_LOOKS[info.getValue()].icon}
                label={t(verdictKeys[info.getValue()])}
                tone={VERDICT_LOOKS[info.getValue()].tone}
              />
            ),
            header: t("results-status"),
            id: "verdict",
            options: verdictChoices,
          }),
        ]}
        data={results}
        loading={loadMore !== null || results.length === 0}
        plain
        rowId={(answer) => answer.attemptId}
      />
      {exhausted && results.length === 0 ? (
        <TableEmpty
          act="reading"
          description={t("filter-empty")}
          title={t("results-no-match")}
        />
      ) : null}
      {loadMore === null ? null : <TableEnd onLoad={loadMore} />}
    </div>
  );
}

/**
 * Questions, in the results page's header row: it opens a sheet with the questions of the exam, one at a
 * time, however many there are. The header row of the sheet's body steps through them or picks one from a
 * list, and stays in place while the statistics and answers scroll under it. The selection lives in this
 * component, so nothing above it is re-rendered. On a phone the button keeps its icon, so the page's name
 * keeps its room.
 */
export function QuestionsAction({
  questions,
}: {
  readonly questions: readonly Question[];
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const [{ moved, selected }, setPlace] = useState({
    moved: false,
    selected: 0,
  });
  const current = Arr.get(questions, selected);
  const move = (index: number) => setPlace({ moved: true, selected: index });
  const items = Arr.map(questions, (question) => ({
    label: t("question", { number: question.number }),
    value: question.id,
  }));

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
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t("questions")}</SheetTitle>
        </SheetHeader>
        {Option.match(current, {
          onNone: () => null,
          onSome: (question) => (
            <div className="border-b p-4">
              <ButtonGroup className="w-full">
                <Button
                  aria-label={common("previous")}
                  disabled={selected === 0}
                  onClick={() => move(selected - 1)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <HugeIcons icon={ArrowLeft01Icon} />
                </Button>
                <Select
                  items={items}
                  onValueChange={(id) =>
                    Option.map(
                      Arr.findFirstIndex(
                        questions,
                        (candidate) => candidate.id === id
                      ),
                      move
                    )
                  }
                  value={question.id}
                >
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Arr.map(items, (item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  aria-label={common("next")}
                  disabled={selected === questions.length - 1}
                  onClick={() => move(selected + 1)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <HugeIcons icon={ArrowRight01Icon} />
                </Button>
              </ButtonGroup>
            </div>
          ),
        })}
        <ScrollArea className="min-h-0 flex-1">
          {Option.match(current, {
            onNone: () => null,
            // Each question holds its own search and verdict filter, so a question opened next starts with every answer.
            onSome: (question) => (
              <TableFiltersProvider key={question.id}>
                <QuestionResults question={question} waits={!moved} />
              </TableFiltersProvider>
            ),
          })}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

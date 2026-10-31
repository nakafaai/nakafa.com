import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  ArrowDown01Icon,
  Search02Icon,
  Tick01Icon,
  TransactionHistoryIcon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@repo/design-system/components/ui/autocomplete";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
import { TryoutScoreMetrics } from "@/components/tryout/score/metrics";
import { TryoutScoreNote } from "@/components/tryout/score/status";
import { formatMoment } from "@/lib/i18n/date";

type HistoryQuery = typeof tryouts.queries.history.bySet;
type HistoryIdentity = Omit<Ref.Args<HistoryQuery>, "paginationOpts">;
type HistoryRow = Ref.Returns<HistoryQuery>["page"][number];
type ScoredHistoryRow = TryoutAttemptHistoryProps["value"]["attempts"][number];
type ScoredAttempt = Pick<
  ScoredHistoryRow,
  "attemptId" | "attemptNumber" | "score" | "startedAt" | "status"
>;

/** Props of the attempt results: `value` holds the scored attempt, its set identity, and the set's page. */
interface TryoutAttemptResultsProps {
  value: {
    attempt: ScoredAttempt;
    identity: HistoryIdentity;
    publicPath: string;
  };
}

/** Props of one attempt row: `value.attempt` is the option the picker lists. */
interface TryoutAttemptHistoryItemProps {
  value: {
    attempt: {
      attemptId: HistoryRow["attemptId"];
      label: string;
      subtitle: string;
    };
    isSelected: boolean;
    onChoose: () => void;
  };
}

/** Renders one selectable attempt row inside the history picker. */
function TryoutAttemptHistoryItem({ value }: TryoutAttemptHistoryItemProps) {
  return (
    <AutocompleteItem
      className="min-h-8 py-1.5 text-sm sm:min-h-8"
      onClick={value.onChoose}
      value={value.attempt}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span>{value.attempt.label}</span>
        <span className="truncate text-muted-foreground text-xs">
          {value.attempt.subtitle}
        </span>
      </div>
      <HugeIcons
        className={cn(
          "ml-auto size-4 opacity-0 transition-opacity ease-out",
          value.isSelected && "opacity-100"
        )}
        icon={Tick01Icon}
      />
    </AutocompleteItem>
  );
}

/** Props of the attempt-history picker: `value` holds the scored attempts and the selection. */
interface TryoutAttemptHistoryProps {
  value: {
    attempts: readonly (HistoryRow & {
      score: NonNullable<HistoryRow["score"]>;
    })[];
    locale: HistoryIdentity["locale"];
    onLoadMore: (() => void) | undefined;
    onChoose: (attemptId: HistoryRow["attemptId"]) => void;
    selectedAttemptId: HistoryRow["attemptId"];
  };
}

/** Renders the prior production attempt-history picker styling. */
function TryoutAttemptHistory({ value }: TryoutAttemptHistoryProps) {
  // Choosing an attempt opens its own page, so the picker closes with the choice.
  const [open, { close, set }] = useDisclosure(false);
  const tTryouts = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const firstAttempt = Arr.head(value.attempts);

  if (Option.isNone(firstAttempt) || value.attempts.length < 2) {
    return null;
  }

  const attemptOptions = Arr.map(value.attempts, (attempt) => ({
    attemptId: attempt.attemptId,
    label: tTryouts("attempt-select-label", {
      number: attempt.attemptNumber,
    }),
    subtitle: formatMoment(attempt.startedAt, value.locale),
  }));
  const attemptGroups = [
    {
      items: attemptOptions,
      value: tTryouts("attempt-menu-label"),
    },
  ];

  return (
    <Popover onOpenChange={set} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="group data-open:[&_.tryout-history-chevron]:rotate-180"
            type="button"
            variant="outline"
          />
        }
      >
        <HugeIcons icon={TransactionHistoryIcon} />
        {tTryouts("attempt-select-label", {
          number: Option.match(
            Arr.findFirst(
              value.attempts,
              (attempt) => attempt.attemptId === value.selectedAttemptId
            ),
            {
              onNone: () => firstAttempt.value.attemptNumber,
              onSome: (attempt) => attempt.attemptNumber,
            }
          ),
        })}
        <HugeIcons
          className="tryout-history-chevron ml-auto size-4 transition-transform ease-out"
          icon={ArrowDown01Icon}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Autocomplete
          autoHighlight="always"
          inline
          items={attemptGroups}
          itemToStringValue={(attempt) =>
            `${attempt.label} ${attempt.subtitle}`
          }
          keepHighlight
          open
        >
          <AutocompleteInput
            className="h-9 rounded-none border-x-0 border-t-0 border-b shadow-none focus-visible:border-border focus-visible:ring-0"
            clearLabel={tCommon("clear-search")}
            placeholder={tTryouts("attempt-menu-search-placeholder")}
            showClear
            startAddon={<HugeIcons className="size-4" icon={Search02Icon} />}
          />
          <AutocompleteEmpty>
            {tTryouts("attempt-menu-empty")}
          </AutocompleteEmpty>
          <AutocompleteList
            className="max-h-64"
            onScroll={(event) => {
              if (!value.onLoadMore) {
                return;
              }

              const target = event.currentTarget;
              const remainingScroll =
                target.scrollHeight - target.scrollTop - target.clientHeight;

              if (remainingScroll <= 48) {
                value.onLoadMore();
              }
            }}
            scrollArea={false}
          >
            {(group) => (
              <AutocompleteGroup items={group.items} key={group.value}>
                <AutocompleteGroupLabel>{group.value}</AutocompleteGroupLabel>
                <AutocompleteCollection>
                  {(attempt) => (
                    <TryoutAttemptHistoryItem
                      key={attempt.attemptId}
                      value={{
                        attempt,
                        isSelected:
                          attempt.attemptId === value.selectedAttemptId,
                        onChoose: () => {
                          close();
                          value.onChoose(attempt.attemptId);
                        },
                      }}
                    />
                  )}
                </AutocompleteCollection>
              </AutocompleteGroup>
            )}
          </AutocompleteList>
        </Autocomplete>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Renders the card of the page's finished attempt, first on its page: a title that says the try-out is
 * finished, one sentence on how it ended, and the picker of the set's attempt history; then its metrics and
 * the metrics the caller composed after them; then how far its score is settled. Choosing an attempt opens
 * that attempt's own page, so the score and the review always belong to one attempt.
 */
export function TryoutAttemptResults({
  children,
  value,
}: TryoutAttemptResultsProps & { children?: ReactNode }) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const navigate = useNavigate();
  const t = useTranslations("Tryouts");
  const history = usePaginatedQuery(
    tryouts.queries.history.bySet,
    isAuthenticated ? value.identity : "skip",
    { initialNumItems: 25 }
  );
  const attempts = useKeptAttempts(
    Arr.filter(history.results, hasScore),
    PaginatedQueryResult.isLoadingFirstPage(history)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("finished-title")}</h2>
        </CardTitle>
        <CardDescription>
          {t(
            value.attempt.status === "expired"
              ? "finished-expired-description"
              : "finished-description"
          )}
        </CardDescription>
        <CardAction>
          <TryoutAttemptHistory
            value={{
              attempts,
              locale: value.identity.locale,
              onLoadMore: PaginatedQueryResult.isCanLoadMore(history)
                ? () => history.loadMore(25)
                : undefined,
              onChoose: (attemptId) => {
                if (attemptId === value.attempt.attemptId) {
                  return;
                }
                navigate({
                  href: `/${value.identity.locale}${getTryoutAttemptHref(value.publicPath, attemptId)}`,
                });
              },
              selectedAttemptId: value.attempt.attemptId,
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="[--number-flow-mask-height:0.125em]">
        {PaginatedQueryResult.isFailure(history) && <DataFailure />}
        <TryoutScoreMetrics score={value.attempt.score}>
          {children}
        </TryoutScoreMetrics>
      </CardContent>
      <CardFooter>
        <TryoutScoreNote score={value.attempt.score} />
      </CardFooter>
    </Card>
  );
}

/**
 * The scored attempts the picker lists: the history's, or the last ones it listed while the history waits for
 * its first page, as during an auth reload that pauses the read. The picker never empties and leaves the
 * score card's header in the meantime. A history's rows never change once scored, so their attempts say
 * whether a new answer differs from the kept one.
 */
function useKeptAttempts(
  attempts: readonly ScoredHistoryRow[],
  waiting: boolean
) {
  const [kept, setKept] = useState(attempts);
  if (waiting) {
    return kept;
  }
  if (!sameAttempts(attempts, kept)) {
    setKept(attempts);
  }
  return attempts;
}

/** Whether two lists name the same attempts in the same order. */
function sameAttempts(
  left: readonly ScoredHistoryRow[],
  right: readonly ScoredHistoryRow[]
) {
  return Arr.makeEquivalence(
    (one: ScoredHistoryRow, other: ScoredHistoryRow) =>
      one.attemptId === other.attemptId
  )(left, right);
}

/** Narrows one attempt-history row to a persisted score result. */
function hasScore(row: HistoryRow): row is ScoredHistoryRow {
  return row.score !== null;
}

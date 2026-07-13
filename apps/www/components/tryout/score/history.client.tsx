"use client";

import {
  ArrowDown01Icon,
  Search02Icon,
  Tick01Icon,
  TransactionHistoryIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { TryoutScoreCard } from "@/components/tryout/score/card";
import { getLocale } from "@/lib/utils/date";

type HistoryQuery = typeof api.tryouts.queries.history.list;
type HistoryRow = FunctionReturnType<HistoryQuery>["page"][number];
type ScoredHistoryRow = HistoryRow & {
  score: NonNullable<HistoryRow["score"]>;
};
type ScoredAttempt = Pick<
  ScoredHistoryRow,
  "attemptId" | "attemptNumber" | "score" | "startedAt" | "status"
>;

interface TryoutAttemptResultsValue {
  attempt: ScoredAttempt;
  locale: Locale;
  publicPath: string;
}

interface AttemptOption {
  attemptId: HistoryRow["attemptId"];
  label: string;
  subtitle: string;
}

/** Renders one selectable attempt row inside the history picker. */
function TryoutAttemptHistoryItem({
  value,
}: {
  value: {
    attempt: AttemptOption;
    isSelected: boolean;
    onChoose: () => void;
  };
}) {
  return (
    <AutocompleteItem
      className="min-h-8 cursor-pointer py-1.5 text-sm sm:min-h-8"
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

/** Renders the prior production attempt-history picker styling. */
function TryoutAttemptHistory({
  value,
}: {
  value: {
    attempts: readonly ScoredHistoryRow[];
    locale: Locale;
    loadMore: (numItems: number) => void;
    onChoose: (attemptId: HistoryRow["attemptId"]) => void;
    selectedAttemptId: HistoryRow["attemptId"];
    status: "CanLoadMore" | "Exhausted" | "LoadingFirstPage" | "LoadingMore";
  };
}) {
  const tTryouts = useTranslations("Tryouts");
  const firstAttempt = value.attempts.at(0);

  if (!firstAttempt || value.attempts.length < 2) {
    return null;
  }

  const attemptOptions = value.attempts.map((attempt) => ({
    attemptId: attempt.attemptId,
    label: tTryouts("attempt-select-label", {
      number: attempt.attemptNumber,
    }),
    subtitle: format(attempt.startedAt, "PPp", {
      locale: getLocale(value.locale),
    }),
  }));
  const attemptGroups = [
    {
      items: attemptOptions,
      value: tTryouts("attempt-menu-label"),
    },
  ];

  return (
    <Popover>
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
          number:
            value.attempts.find(
              (attempt) => attempt.attemptId === value.selectedAttemptId
            )?.attemptNumber ?? firstAttempt.attemptNumber,
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
            className="h-9 rounded-none border-x-0 border-t-0 border-b shadow-none focus-visible:ring-inset"
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
              if (value.status !== "CanLoadMore") {
                return;
              }

              const target = event.currentTarget;
              const remainingScroll =
                target.scrollHeight - target.scrollTop - target.clientHeight;

              if (remainingScroll <= 48) {
                value.loadMore(25);
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
                        onChoose: () => value.onChoose(attempt.attemptId),
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

/** Renders a score card with selectable immutable attempt history. */
export function TryoutAttemptResults({
  children,
  value,
}: {
  children: ReactNode;
  value: TryoutAttemptResultsValue;
}) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<
    HistoryRow["attemptId"] | null
  >(null);
  const history = usePaginatedQuery(
    api.tryouts.queries.history.list,
    {
      locale: value.locale,
      publicPath: value.publicPath,
    },
    { initialNumItems: 25 }
  );
  const attempts = history.results.filter(hasScore);
  const selectedAttempt = selectedAttemptId
    ? attempts.find((attempt) => attempt.attemptId === selectedAttemptId)
    : undefined;
  const visibleAttempt = selectedAttempt ?? value.attempt;

  return (
    <div className="w-full space-y-4">
      <TryoutScoreCard
        value={{ score: visibleAttempt.score, status: visibleAttempt.status }}
      />
      <div className="flex min-h-9 w-full flex-wrap items-center gap-3">
        <TryoutAttemptHistory
          value={{
            attempts,
            locale: value.locale,
            loadMore: history.loadMore,
            onChoose: setSelectedAttemptId,
            selectedAttemptId: visibleAttempt.attemptId,
            status: history.status,
          }}
        />
        {children}
      </div>
    </div>
  );
}

/** Narrows one attempt-history row to a persisted score result. */
function hasScore(row: HistoryRow): row is ScoredHistoryRow {
  return row.score !== null;
}

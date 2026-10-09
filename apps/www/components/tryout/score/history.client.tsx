"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  ArrowDown01Icon,
  Search02Icon,
  Tick01Icon,
  TransactionHistoryIcon,
} from "@hugeicons/core-free-icons";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "cn";
import { format } from "date-fns";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { TryoutScoreCard } from "@/components/tryout/score/card";
import { getLocale } from "@/lib/utils/date";

type HistoryQuery = typeof tryouts.queries.history.bySet;
type HistoryIdentity = Omit<Ref.Args<HistoryQuery>, "paginationOpts">;
type HistoryRow = Ref.Returns<HistoryQuery>["page"][number];
type ScoredHistoryRow = TryoutAttemptHistoryProps["value"]["attempts"][number];
type ScoredAttempt = Pick<
  ScoredHistoryRow,
  "attemptId" | "attemptNumber" | "score" | "startedAt" | "status"
>;

/** Props of the attempt results: `value` holds the scored attempt and its set identity. */
interface TryoutAttemptResultsProps {
  value: {
    attempt: ScoredAttempt;
    identity: HistoryIdentity;
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
  const tTryouts = useTranslations("Tryouts");
  const firstAttempt = Arr.head(value.attempts);

  if (Option.isNone(firstAttempt) || value.attempts.length < 2) {
    return null;
  }

  const attemptOptions = Arr.map(value.attempts, (attempt) => ({
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
export function TryoutAttemptResults({ value }: TryoutAttemptResultsProps) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const [selectedAttemptId, setSelectedAttemptId] = useState<
    HistoryRow["attemptId"] | null
  >(null);
  const history = usePaginatedQuery(
    tryouts.queries.history.bySet,
    isAuthenticated ? value.identity : "skip",
    { initialNumItems: 25 }
  );
  const attempts = Arr.filter(history.results, hasScore);
  const selectedAttempt = selectedAttemptId
    ? Arr.findFirst(
        attempts,
        (attempt) => attempt.attemptId === selectedAttemptId
      )
    : Option.none();
  const visibleAttempt = Option.getOrElse(selectedAttempt, () => value.attempt);

  return (
    <TryoutScoreCard
      value={{ score: visibleAttempt.score, status: visibleAttempt.status }}
    >
      {PaginatedQueryResult.isFailure(history) && <DataFailure />}
      <TryoutAttemptHistory
        value={{
          attempts,
          locale: value.identity.locale,
          onLoadMore: PaginatedQueryResult.isCanLoadMore(history)
            ? () => history.loadMore(25)
            : undefined,
          onChoose: setSelectedAttemptId,
          selectedAttemptId: visibleAttempt.attemptId,
        }}
      />
    </TryoutScoreCard>
  );
}

/** Narrows one attempt-history row to a persisted score result. */
function hasScore(row: HistoryRow): row is ScoredHistoryRow {
  return row.score !== null;
}

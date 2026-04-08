"use client";

import {
  ArrowDown01Icon,
  PartyIcon,
  Progress03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { type ComponentProps, type ReactNode, useTransition } from "react";
import { tryoutSearchParsers } from "@/components/tryout/nuqs/attempt";
import { useTryoutSet } from "@/components/tryout/providers/set-state";
import { TryoutScoreCard } from "@/components/tryout/score-card";
import { getLocale } from "@/lib/utils/date";

type TryoutAttempt = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt>
>["attempt"];

type TryoutAttemptHistoryItem = FunctionReturnType<
  typeof api.tryouts.queries.me.history.getUserTryoutAttemptHistory
>["page"][number];

interface AttemptOption {
  attemptId: string;
  icon: NonNullable<ComponentProps<typeof HugeIcons>["icon"]>;
  label: string;
  subtitle: string;
}

interface Props {
  children?: ReactNode;
  fallbackAttempt: TryoutAttempt;
  fallbackStatus: TryoutAttempt["status"];
}

/** Build one selectable history option from one history row. */
function getAttemptOption({
  attempt,
  locale,
  tTryouts,
}: {
  attempt: Pick<
    TryoutAttemptHistoryItem,
    "attemptId" | "countsForCompetition" | "startedAt"
  >;
  locale: Locale;
  tTryouts: ReturnType<typeof useTranslations<"Tryouts">>;
}) {
  return {
    attemptId: attempt.attemptId,
    icon: attempt.countsForCompetition ? PartyIcon : Progress03Icon,
    label: attempt.countsForCompetition
      ? tTryouts("attempt-select-event")
      : tTryouts("attempt-select-retry"),
    subtitle: format(attempt.startedAt, "PPp", {
      locale: getLocale(locale),
    }),
  } satisfies AttemptOption;
}

/** Render one selectable attempt row inside the history picker. */
function TryoutAttemptHistoryItem({
  attempt,
  isSelected,
  onSelect,
}: {
  attempt: AttemptOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem className="cursor-pointer" onSelect={onSelect}>
      <HugeIcons icon={attempt.icon} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span>{attempt.label}</span>
        <span className="truncate text-muted-foreground text-xs">
          {attempt.subtitle}
        </span>
      </div>
      <HugeIcons
        className={cn(
          "ml-auto size-4 opacity-0 transition-opacity ease-out",
          isSelected && "opacity-100"
        )}
        icon={Tick01Icon}
      />
    </CommandItem>
  );
}

/** Render the history picker and the finished-attempt action row. */
function TryoutAttemptHistoryControls({
  children,
  fallbackAttempt,
}: {
  children?: ReactNode;
  fallbackAttempt: TryoutAttempt;
}) {
  const tTryouts = useTranslations("Tryouts");
  const locale = useTryoutSet((state) => state.params.locale);
  const product = useTryoutSet((state) => state.params.product);
  const tryoutSlug = useTryoutSet((state) => state.params.tryoutSlug);
  const initialAttemptHistory = useTryoutSet(
    (state) => state.state.initialAttemptHistory
  );
  const { isAuthenticated, isLoading } = useConvexAuth();
  const shouldLoadAttemptHistory = !isLoading && isAuthenticated;
  const {
    loadMore,
    results: attemptHistory,
    status,
  } = usePaginatedQuery(
    api.tryouts.queries.me.history.getUserTryoutAttemptHistory,
    shouldLoadAttemptHistory
      ? {
          locale,
          product,
          tryoutSlug,
        }
      : "skip",
    { initialNumItems: 25 }
  );
  const [isSelectingAttempt, startTransition] = useTransition();
  const [, setSelectedAttemptId] = useQueryState(
    "attempt",
    tryoutSearchParsers.attempt
  );

  if (
    !(children || attemptHistory.length > 1 || initialAttemptHistory.length > 1)
  ) {
    return null;
  }

  const activeAttemptId = fallbackAttempt._id;
  const visibleAttemptHistory =
    status === "LoadingFirstPage" ? initialAttemptHistory : attemptHistory;
  const latestAttemptId =
    visibleAttemptHistory[0]?.attemptId ?? fallbackAttempt._id;
  const attemptOptions: AttemptOption[] = [];
  let hasActiveAttempt = false;

  for (const historyAttempt of visibleAttemptHistory) {
    const attemptOption = getAttemptOption({
      attempt: historyAttempt,
      locale,
      tTryouts,
    });

    attemptOptions.push(attemptOption);

    if (attemptOption.attemptId === activeAttemptId) {
      hasActiveAttempt = true;
    }
  }

  if (!hasActiveAttempt) {
    attemptOptions.unshift(
      getAttemptOption({
        attempt: {
          attemptId: fallbackAttempt._id,
          countsForCompetition: fallbackAttempt.countsForCompetition ?? false,
          startedAt: fallbackAttempt.startedAt,
        },
        locale,
        tTryouts,
      })
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      {visibleAttemptHistory.length > 1 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="group [&[data-state=open]_.tryout-history-chevron]:rotate-180"
              disabled={isSelectingAttempt || status === "LoadingFirstPage"}
              type="button"
              variant="outline"
            >
              <HugeIcons icon={Progress03Icon} />
              {tTryouts("attempt-menu-label")}
              <HugeIcons
                className="tryout-history-chevron ml-auto size-4 transition-transform ease-out"
                icon={ArrowDown01Icon}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command>
              <CommandInput placeholder={tTryouts("attempt-menu-label")} />
              <CommandList
                className="max-h-64"
                onScroll={(event) => {
                  if (status !== "CanLoadMore") {
                    return;
                  }

                  const target = event.currentTarget;
                  const remainingScroll =
                    target.scrollHeight -
                    target.scrollTop -
                    target.clientHeight;

                  if (remainingScroll > 48) {
                    return;
                  }

                  loadMore(25);
                }}
              >
                <CommandEmpty>{tTryouts("attempt-menu-empty")}</CommandEmpty>
                <CommandGroup heading={tTryouts("attempt-menu-label")}>
                  {attemptOptions.map((attemptOption) => {
                    return (
                      <TryoutAttemptHistoryItem
                        attempt={attemptOption}
                        isSelected={attemptOption.attemptId === activeAttemptId}
                        key={attemptOption.attemptId}
                        onSelect={() => {
                          setSelectedAttemptId(
                            attemptOption.attemptId === latestAttemptId
                              ? null
                              : attemptOption.attemptId,
                            {
                              shallow: false,
                              startTransition,
                            }
                          );
                        }}
                      />
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : null}
      {children}
    </div>
  );
}

/** Render the finished tryout scorecard with history controls. */
export function TryoutAttemptResults({
  children,
  fallbackAttempt,
  fallbackStatus,
}: Props) {
  return (
    <div className="w-full space-y-4">
      <TryoutScoreCard attempt={fallbackAttempt} status={fallbackStatus} />
      <TryoutAttemptHistoryControls fallbackAttempt={fallbackAttempt}>
        {children}
      </TryoutAttemptHistoryControls>
    </div>
  );
}

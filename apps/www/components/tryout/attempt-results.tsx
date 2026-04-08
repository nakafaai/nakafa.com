"use client";

import {
  PartyIcon,
  Progress03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { type ReactNode, useTransition } from "react";
import { tryoutSearchParsers } from "@/components/tryout/nuqs/attempt";
import { useTryoutSet } from "@/components/tryout/providers/set-state";
import { TryoutScoreCard } from "@/components/tryout/score-card";

type TryoutAttempt = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt>
>["attempt"];

type TryoutAttemptHistoryItem = FunctionReturnType<
  typeof api.tryouts.queries.me.history.getUserTryoutAttemptHistory
>["page"][number];

interface Props {
  action?: ReactNode;
  fallbackAttempt: TryoutAttempt;
  fallbackStatus: TryoutAttempt["status"];
}

interface AttemptOption {
  attemptId: string;
  icon: typeof PartyIcon | typeof Progress03Icon;
  label: string;
  subtitle: string;
}

/** Format one attempt timestamp for the history picker. */
function formatAttemptTimestamp(locale: string, value: number) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

/** Build one dropdown option from one stored history row. */
function getAttemptOption({
  attempt,
  locale,
  tTryouts,
}: {
  attempt: Pick<
    TryoutAttemptHistoryItem,
    "attemptId" | "countsForCompetition" | "startedAt"
  >;
  locale: string;
  tTryouts: ReturnType<typeof useTranslations<"Tryouts">>;
}): AttemptOption {
  return {
    attemptId: attempt.attemptId,
    icon: attempt.countsForCompetition ? PartyIcon : Progress03Icon,
    label: attempt.countsForCompetition
      ? tTryouts("attempt-select-event")
      : tTryouts("attempt-select-retry"),
    subtitle: formatAttemptTimestamp(locale, attempt.startedAt),
  };
}

/**
 * Render the selected tryout scorecard and the controls for browsing older
 * attempts.
 */
export function TryoutAttemptResults({
  action,
  fallbackAttempt,
  fallbackStatus,
}: Props) {
  return (
    <div className="w-full space-y-4">
      <TryoutScoreCard attempt={fallbackAttempt} status={fallbackStatus} />
      <TryoutAttemptHistoryControls
        action={action}
        fallbackAttempt={fallbackAttempt}
      />
    </div>
  );
}

/** Render the history picker next to the primary finished-attempt action. */
function TryoutAttemptHistoryControls({
  action,
  fallbackAttempt,
}: {
  action?: ReactNode;
  fallbackAttempt: TryoutAttempt;
}) {
  const tTryouts = useTranslations("Tryouts");
  const locale = useTryoutSet((state) => state.params.locale);
  const product = useTryoutSet((state) => state.params.product);
  const tryoutSlug = useTryoutSet((state) => state.params.tryoutSlug);
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
  const [isPending, startTransition] = useTransition();
  const [, setSelectedAttemptId] = useQueryState(
    "attempt",
    tryoutSearchParsers.attempt
  );

  if (!(action || attemptHistory.length > 1)) {
    return null;
  }

  const latestAttemptId = attemptHistory[0]?.attemptId ?? fallbackAttempt._id;
  const activeAttemptId = fallbackAttempt._id;
  const attemptOptions = attemptHistory.map((attempt) =>
    getAttemptOption({
      attempt,
      locale,
      tTryouts,
    })
  );

  if (
    !attemptOptions.some((attempt) => attempt.attemptId === activeAttemptId)
  ) {
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
      {attemptHistory.length > 1 ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button disabled={isPending} type="button" variant="outline">
              <HugeIcons icon={Progress03Icon} />
              {tTryouts("attempt-menu-label")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-64 min-w-64"
            onScroll={(event) => {
              if (status !== "CanLoadMore") {
                return;
              }

              const target = event.currentTarget;
              const remainingScroll =
                target.scrollHeight - target.scrollTop - target.clientHeight;

              if (remainingScroll > 48) {
                return;
              }

              loadMore(25);
            }}
          >
            <DropdownMenuLabel>
              {tTryouts("attempt-menu-label")}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {attemptOptions.map((attempt) => {
                const isSelected = attempt.attemptId === activeAttemptId;

                return (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    key={attempt.attemptId}
                    onSelect={() => {
                      setSelectedAttemptId(
                        attempt.attemptId === latestAttemptId
                          ? null
                          : attempt.attemptId,
                        {
                          shallow: false,
                          startTransition,
                        }
                      );
                    }}
                  >
                    <HugeIcons icon={attempt.icon} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span>{attempt.label}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {attempt.subtitle}
                      </span>
                    </div>
                    <DropdownMenuShortcut>
                      <HugeIcons
                        className={cn(
                          "size-4 transition-opacity ease-out",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                        icon={Tick01Icon}
                      />
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {action}
    </div>
  );
}

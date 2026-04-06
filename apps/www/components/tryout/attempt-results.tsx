"use client";

import { PartyIcon, Progress03Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { useTryoutAttemptState } from "@/components/tryout/providers/attempt-state";
import { TryoutScoreCard } from "@/components/tryout/score-card";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";

type TryoutAttempt = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt>
>["attempt"];

interface Props {
  fallbackAttempt: TryoutAttempt;
  fallbackStatus: TryoutAttempt["status"];
}

export function TryoutAttemptResults({
  fallbackAttempt,
  fallbackStatus,
}: Props) {
  const tTryouts = useTranslations("Tryouts");
  const locale = useTryoutAttemptState((state) => state.params.locale);
  const product = useTryoutAttemptState((state) => state.params.product);
  const tryoutSlug = useTryoutAttemptState((state) => state.params.tryoutSlug);
  const {
    loadMore,
    results: attemptHistory,
    status,
  } = usePaginatedQuery(
    api.tryouts.queries.me.history.getUserTryoutAttemptHistory,
    {
      locale,
      product,
      tryoutSlug,
    },
    { initialNumItems: 25 }
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const nowMs = useTryoutClock(
    attemptHistory.some((attempt) => attempt.status === "in-progress")
  );

  if (status === "LoadingFirstPage" || attemptHistory.length === 0) {
    return (
      <TryoutScoreCard attempt={fallbackAttempt} status={fallbackStatus} />
    );
  }
  const attemptOptions = attemptHistory.map((attempt, index) => {
    return {
      ...attempt,
      icon: attempt.countsForCompetition ? PartyIcon : Progress03Icon,
      label: attempt.countsForCompetition
        ? tTryouts("attempt-select-event", {
            number: index + 1,
          })
        : tTryouts("attempt-select-retry", {
            number: index + 1,
          }),
      status: getEffectiveTryoutStatus({
        expiresAtMs: attempt.expiresAt,
        nowMs,
        status: attempt.status,
      }),
    };
  });
  const selectedAttempt =
    attemptOptions.find((attempt) => attempt.attemptId === selectedAttemptId) ??
    null;
  const fallbackOption =
    attemptOptions.find(
      (attempt) => attempt.attemptId === fallbackAttempt._id
    ) ?? null;
  const displayedAttempt = selectedAttempt ?? fallbackAttempt;
  const displayedStatus =
    selectedAttempt?.status ?? fallbackOption?.status ?? fallbackStatus;
  const triggerIcon =
    selectedAttempt?.icon ??
    fallbackOption?.icon ??
    (fallbackAttempt.countsForCompetition ? PartyIcon : Progress03Icon);
  const triggerLabel =
    selectedAttempt?.label ??
    fallbackOption?.label ??
    tTryouts("attempt-menu-label");

  return (
    <div className="w-full space-y-4">
      <TryoutScoreCard attempt={displayedAttempt} status={displayedStatus} />

      {attemptHistory.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              <HugeIcons icon={triggerIcon} />
              {triggerLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
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
            <DropdownMenuRadioGroup
              onValueChange={setSelectedAttemptId}
              value={selectedAttemptId || undefined}
            >
              {attemptOptions.map((attempt) => (
                <DropdownMenuRadioItem
                  key={attempt.attemptId}
                  value={attempt.attemptId}
                >
                  <HugeIcons icon={attempt.icon} />
                  {attempt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

"use client";

import { PartyIcon, Progress03Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
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
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  const { data: rawAttemptHistory } = useQueryWithStatus(
    api.tryouts.queries.me.history.getUserTryoutAttemptHistory,
    {
      locale,
      product,
      tryoutSlug,
    }
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const attemptHistory = rawAttemptHistory ?? [];

  if (attemptHistory.length === 0) {
    return (
      <TryoutScoreCard attempt={fallbackAttempt} status={fallbackStatus} />
    );
  }

  const nowMs = Date.now();
  const attemptOptions = attemptHistory.map((attempt) => ({
    ...attempt,
    icon: attempt.countsForCompetition ? PartyIcon : Progress03Icon,
    label: attempt.countsForCompetition
      ? tTryouts("attempt-select-event", {
          number: attempt.attemptNumber,
        })
      : tTryouts("attempt-select-retry", {
          number: attempt.attemptNumber,
        }),
    status: getEffectiveTryoutStatus({
      expiresAtMs: attempt.expiresAt,
      nowMs,
      status: attempt.status,
    }),
  }));
  const defaultAttempt =
    attemptOptions.find((attempt) => attempt.countsForCompetition) ??
    attemptOptions.at(-1) ??
    null;
  const selectedAttempt =
    attemptOptions.find((attempt) => attempt.attemptId === selectedAttemptId) ??
    defaultAttempt;

  if (!selectedAttempt) {
    return (
      <TryoutScoreCard attempt={fallbackAttempt} status={fallbackStatus} />
    );
  }

  return (
    <div className="space-y-4">
      <TryoutScoreCard
        attempt={selectedAttempt}
        status={selectedAttempt.status}
      />

      {attemptHistory.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              <HugeIcons icon={selectedAttempt.icon} />
              {selectedAttempt.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              {tTryouts("attempt-menu-label")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={setSelectedAttemptId}
              value={selectedAttempt.attemptId}
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

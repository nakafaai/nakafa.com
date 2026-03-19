"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { ComponentProps, ReactNode } from "react";
import {
  TryoutPartBackCta,
  TryoutPartDialog,
  TryoutPartStartCta,
  TryoutPartSticky,
  TryoutPartTryoutCta,
} from "@/components/tryout/part-actions";
import { TryoutPartHead } from "@/components/tryout/part-head";
import {
  TryoutPartMetrics,
  TryoutPartStatus,
} from "@/components/tryout/part-info";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartSummary,
} from "@/components/tryout/part-shell";
import {
  TryoutPartProvider,
  type TryoutPartValue,
  type TryoutValue,
  useTryoutPart,
} from "@/components/tryout/part-state";
import { AttemptProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";
import { useUser } from "@/lib/context/use-user";

export interface TryoutPartRuntimeProps {
  children: ReactNode;
  icon?: ComponentProps<typeof TryoutPartHead>["icon"];
  part: TryoutPartValue;
  tryout: TryoutValue;
}

export function TryoutPartRuntime({
  children,
  icon,
  part,
  tryout,
}: TryoutPartRuntimeProps) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const { data: partState, isPending: isPartStatePending } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutPartAttempt,
    !isUserPending && user
      ? {
          locale: tryout.locale,
          partKey: part.key,
          product: tryout.product,
          tryoutSlug: tryout.slug,
        }
      : "skip"
  );
  const attempt = partState?.partAttempt?.setAttempt ?? null;
  const answers = partState?.partAttempt?.answers ?? [];
  const shouldRequestAnswerSheet = Boolean(
    !isUserPending && user && attempt?.status === "in-progress"
  );
  const { data: answerSheet, isPending: isAnswerSheetPending } =
    useQueryWithStatus(
      api.exercises.queries.getQuestionAnswerSheetBySlug,
      shouldRequestAnswerSheet
        ? { locale: tryout.locale, slug: part.setSlug }
        : "skip"
    );
  const isRuntimePending = isUserPending || (user ? isPartStatePending : false);
  const isQuestionDataPending =
    shouldRequestAnswerSheet && isAnswerSheetPending;
  const shouldShowQuestions =
    !(isRuntimePending || isQuestionDataPending) &&
    attempt?.status === "in-progress";

  return (
    <ExerciseContextProvider slug={part.setSlug}>
      <AttemptProvider
        value={{
          answerSheet: answerSheet ?? [],
          answers,
          attempt,
          slug: part.setSlug,
        }}
      >
        <TryoutPartProvider
          isRuntimePending={isRuntimePending}
          part={part}
          runtime={partState}
          tryout={tryout}
        >
          <div className="space-y-6">
            <TryoutPartHead icon={icon} />

            <div className="space-y-12">
              <TryoutPartSticky />
              <TryoutPartSummaryCard />
              <TryoutPartDialog />
              {shouldShowQuestions ? children : null}
            </div>
          </div>
        </TryoutPartProvider>
      </AttemptProvider>
    </ExerciseContextProvider>
  );
}

function TryoutPartSummaryCard() {
  const status = useTryoutPart((state) => state.state.status);

  if (status === "in-progress") {
    return null;
  }

  return (
    <TryoutPartSummary>
      <TryoutPartStatus />

      <TryoutPartBody>
        <TryoutPartLead>
          <TryoutPartMetrics />
        </TryoutPartLead>

        <TryoutPartCtas>
          <TryoutPartTryoutCta />
          <TryoutPartStartCta />
          <TryoutPartBackCta />
        </TryoutPartCtas>
      </TryoutPartBody>
    </TryoutPartSummary>
  );
}

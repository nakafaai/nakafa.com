"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { ComponentProps, ReactNode } from "react";
import {
  TryoutPartBackCta,
  TryoutPartCompleteExpiredCta,
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
  const isRuntimePending = isUserPending || (user ? isPartStatePending : false);

  return (
    <ExerciseContextProvider slug={part.setSlug}>
      <TryoutPartProvider
        isRuntimePending={isRuntimePending}
        part={part}
        runtime={partState}
        tryout={tryout}
      >
        <TryoutPartRuntimeBody icon={icon} part={part} tryout={tryout}>
          {children}
        </TryoutPartRuntimeBody>
      </TryoutPartProvider>
    </ExerciseContextProvider>
  );
}

function TryoutPartRuntimeBody({
  children,
  icon,
  part,
  tryout,
}: TryoutPartRuntimeProps) {
  const attempt = useTryoutPart(
    (state) => state.state.partAttempt?.setAttempt ?? null
  );
  const answers = useTryoutPart(
    (state) => state.state.runtime?.partAttempt?.answers ?? []
  );
  const status = useTryoutPart((state) => state.state.status);
  const shouldRequestAnswerSheet = status === "in-progress";
  const { data: answerSheet, isPending: isAnswerSheetPending } =
    useQueryWithStatus(
      api.exercises.queries.getQuestionAnswerSheetBySlug,
      shouldRequestAnswerSheet
        ? { locale: tryout.locale, slug: part.setSlug }
        : "skip"
    );
  const shouldShowQuestions = status === "in-progress" && !isAnswerSheetPending;

  return (
    <AttemptProvider
      value={{
        answerSheet: answerSheet ?? [],
        answers,
        attempt,
        slug: part.setSlug,
      }}
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
    </AttemptProvider>
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
          <TryoutPartCompleteExpiredCta />
          <TryoutPartBackCta />
        </TryoutPartCtas>
      </TryoutPartBody>
    </TryoutPartSummary>
  );
}

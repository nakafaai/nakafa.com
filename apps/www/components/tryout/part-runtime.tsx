"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { Preloaded } from "convex/react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import {
  TryoutPartBackCta,
  TryoutPartDialog,
  TryoutPartStartCta,
  TryoutPartSticky,
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
import { TryoutAttemptStateProvider } from "@/components/tryout/providers/attempt-state";
import {
  TryoutPartProvider,
  type TryoutPartValue,
  type TryoutValue,
  useTryoutPart,
} from "@/components/tryout/providers/part-state";
import { TryoutStartButton } from "@/components/tryout/start-button";
import { AttemptProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";

export interface TryoutPartRuntimeProps {
  children: ReactNode;
  icon?: ComponentProps<typeof TryoutPartHead>["icon"];
  initialNowMs?: number;
  part: TryoutPartValue;
  preloadedRuntime?: Preloaded<
    typeof api.tryouts.queries.me.part.getUserTryoutPartAttempt
  >;
  tryout: TryoutValue;
}

export function TryoutPartRuntime({
  children,
  icon,
  initialNowMs,
  preloadedRuntime,
  part,
  tryout,
}: TryoutPartRuntimeProps) {
  return (
    <ExerciseContextProvider slug={part.setSlug}>
      <TryoutPartProvider
        initialNowMs={initialNowMs}
        part={part}
        preloadedRuntime={preloadedRuntime}
        tryout={tryout}
      >
        <TryoutPartRuntimeBody icon={icon} initialNowMs={initialNowMs}>
          {children}
        </TryoutPartRuntimeBody>
      </TryoutPartProvider>
    </ExerciseContextProvider>
  );
}

function TryoutPartRuntimeBody({
  children,
  icon,
  initialNowMs,
}: Pick<TryoutPartRuntimeProps, "children" | "icon" | "initialNowMs">) {
  const attempt = useTryoutPart((state) => state.state.attempt);
  const answers = useTryoutPart((state) => state.state.answers);
  const isInputLocked = useTryoutPart((state) => state.state.isAwaitingExpiry);
  const part = useTryoutPart((state) => state.state.part);
  const isTryoutFinished = useTryoutPart(
    (state) => state.state.isTryoutFinished
  );
  const status = useTryoutPart((state) => state.state.status);
  const tryout = useTryoutPart((state) => state.state.tryout);
  const isReviewMode = isTryoutFinished;
  const shouldRequestAnswerSheet = status === "in-progress" || isReviewMode;
  const { data: answerSheet, isPending: isAnswerSheetPending } =
    useQueryWithStatus(
      api.exercises.queries.getQuestionAnswerSheetBySlug,
      shouldRequestAnswerSheet
        ? { locale: tryout.locale, slug: part.setSlug }
        : "skip"
    );
  const shouldShowQuestions = shouldRequestAnswerSheet && !isAnswerSheetPending;

  return (
    <AttemptProvider
      value={{
        answerSheet: answerSheet ?? [],
        answers,
        attempt,
        isInputLocked,
        isReviewMode,
        slug: part.setSlug,
      }}
    >
      <div className="space-y-6">
        <TryoutPartHead icon={icon} />

        <div className="space-y-12">
          <TryoutPartCompletionControls />
          <TryoutPartSummaryCard initialNowMs={initialNowMs} />
          {shouldShowQuestions ? children : null}
        </div>
      </div>
    </AttemptProvider>
  );
}

function TryoutPartCompletionControls() {
  const [isCompleteDialogOpen, setCompleteDialogOpen] = useState(false);

  return (
    <>
      <TryoutPartSticky setCompleteDialogOpenAction={setCompleteDialogOpen} />
      <TryoutPartDialog
        isCompleteDialogOpen={isCompleteDialogOpen}
        setCompleteDialogOpenAction={setCompleteDialogOpen}
      />
    </>
  );
}

function TryoutPartSummaryCard({
  initialNowMs,
}: Pick<TryoutPartRuntimeProps, "initialNowMs">) {
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
          <TryoutPartTryoutStartButton initialNowMs={initialNowMs} />
          <TryoutPartStartCta />
          <TryoutPartBackCta />
        </TryoutPartCtas>
      </TryoutPartBody>
    </TryoutPartSummary>
  );
}

function TryoutPartTryoutStartButton({
  initialNowMs,
}: Pick<TryoutPartRuntimeProps, "initialNowMs">) {
  const shouldShowTryoutStartButton = useTryoutPart(
    (state) => state.state.shouldShowTryoutStartButton
  );
  const tryout = useTryoutPart((state) => state.state.tryout);

  if (!shouldShowTryoutStartButton) {
    return null;
  }

  return (
    <TryoutAttemptStateProvider
      initialNowMs={initialNowMs}
      locale={tryout.locale}
      product={tryout.product}
      tryoutSlug={tryout.slug}
    >
      <TryoutStartButton />
    </TryoutAttemptStateProvider>
  );
}

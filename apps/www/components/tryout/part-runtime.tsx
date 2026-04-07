"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useTranslations } from "next-intl";
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
import { useTryoutPart } from "@/components/tryout/providers/part-state";
import {
  TryoutStartActionButton,
  TryoutStartConfirmDialog,
} from "@/components/tryout/start-controls";
import { AttemptProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";

export interface TryoutPartRuntimeProps {
  children: ReactNode;
  icon?: ComponentProps<typeof TryoutPartHead>["icon"];
}

/** Renders the full part runtime view from the active part-route providers. */
export function TryoutPartRuntime({ children, icon }: TryoutPartRuntimeProps) {
  const setSlug = useTryoutPart((state) => state.state.part.setSlug);

  return (
    <ExerciseContextProvider slug={setSlug}>
      <TryoutPartRuntimeBody icon={icon}>{children}</TryoutPartRuntimeBody>
    </ExerciseContextProvider>
  );
}

/** Renders the runtime body after the route providers have resolved state. */
function TryoutPartRuntimeBody({
  children,
  icon,
}: Pick<TryoutPartRuntimeProps, "children" | "icon">) {
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
          <TryoutPartSummaryCard />
          {shouldShowQuestions ? children : null}
        </div>
      </div>
    </AttemptProvider>
  );
}

/** Owns the completion dialog visibility for the sticky part controls. */
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

/** Renders the summary card shown whenever the current part is not in progress. */
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
          <TryoutPartTryoutStartControls />
          <TryoutPartStartCta />
          <TryoutPartBackCta />
        </TryoutPartCtas>
      </TryoutPartBody>
    </TryoutPartSummary>
  );
}

/** Renders the route-level start controls when this part has no active tryout. */
function TryoutPartTryoutStartControls() {
  const tTryouts = useTranslations("Tryouts");
  const clickTryoutStartAction = useTryoutPart(
    (state) => state.actions.clickTryoutStartAction
  );
  const confirmTryoutStartAction = useTryoutPart(
    (state) => state.actions.confirmTryoutStartAction
  );
  const setTryoutStartDialogOpenAction = useTryoutPart(
    (state) => state.actions.setTryoutStartDialogOpenAction
  );
  const isActionPending = useTryoutPart((state) => state.meta.isActionPending);
  const isStartBlocked = useTryoutPart((state) => state.meta.isStartBlocked);
  const isTryoutStartDialogOpen = useTryoutPart(
    (state) => state.meta.isTryoutStartDialogOpen
  );
  const shouldShowTryoutStartControls = useTryoutPart(
    (state) => state.state.shouldShowTryoutStartControls
  );

  if (!shouldShowTryoutStartControls) {
    return null;
  }

  return (
    <>
      <TryoutStartActionButton
        className="w-full sm:w-auto"
        disabled={isStartBlocked}
        isPending={isActionPending}
        onClick={clickTryoutStartAction}
      >
        {tTryouts("start-cta")}
      </TryoutStartActionButton>

      <TryoutStartConfirmDialog
        cancelLabel={tTryouts("cancel-cta")}
        confirmLabel={tTryouts("start-cta")}
        description={tTryouts("start-dialog-description")}
        isBlocked={isStartBlocked}
        isOpen={isTryoutStartDialogOpen}
        isPending={isActionPending}
        onConfirmAction={confirmTryoutStartAction}
        setOpenAction={setTryoutStartDialogOpenAction}
        title={tTryouts("start-dialog-title")}
      />
    </>
  );
}

"use client";

import { useTryoutClock } from "@/components/tryout/clock";
import type { TryoutQuestionContent } from "@/components/tryout/content";
import { TryoutRuntimeControls } from "@/components/tryout/controls.client";
import { TryoutRuntimeQuestion } from "@/components/tryout/question.client";
import type { TryoutSectionRuntime } from "@/components/tryout/types";

interface TryoutRuntimeProps {
  isExpired: boolean;
  questions: readonly TryoutQuestionContent[];
  returnHref: string;
  runtime: TryoutSectionRuntime;
}

/** Renders the active Convex-backed try-out section runtime. */
export function TryoutRuntime({
  isExpired,
  questions,
  returnHref,
  runtime,
}: TryoutRuntimeProps) {
  const isActive = runtime.section.status === "in-progress";
  const remainingSeconds = useRemainingSeconds(runtime.expiresAt, isActive);
  const contentBySnapshot = new Map(
    questions.map((question) => [
      getQuestionContentKey(question),
      question.content,
    ])
  );
  const runtimeQuestions = runtime.questions.map((question) => ({
    content: contentBySnapshot.get(getQuestionContentKey(question)) ?? null,
    question,
  }));

  if (runtimeQuestions.some(({ content }) => content === null)) {
    return null;
  }

  return (
    <section className="space-y-12">
      {isActive ? (
        <TryoutRuntimeControls
          isExpired={isExpired}
          remainingSeconds={remainingSeconds}
          returnHref={returnHref}
          runtime={runtime}
        />
      ) : null}

      {runtimeQuestions.map(({ content, question }) => (
        <TryoutRuntimeQuestion
          content={content}
          isLocked={isExpired || !isActive}
          isReviewMode={!isActive}
          key={question.placementId}
          question={question}
          sectionStartedAt={runtime.section.startedAt}
        />
      ))}
    </section>
  );
}

/** Tracks remaining section seconds from the Convex expiry timestamp. */
function useRemainingSeconds(expiresAt: number, isActive: boolean) {
  const now = useTryoutClock(isActive);

  if (!isActive) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

/** Builds the stable content identity captured when the attempt was created. */
function getQuestionContentKey({
  contentHash,
  sourcePath,
  sourceRevision,
}: {
  contentHash: string;
  sourcePath: string;
  sourceRevision: string;
}) {
  return `${sourcePath}:${contentHash}:${sourceRevision}`;
}

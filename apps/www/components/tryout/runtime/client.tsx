"use client";

import type { TryoutQuestionContent } from "@/components/tryout/content/load";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { TryoutRuntimeControls } from "@/components/tryout/runtime/controls.client";
import { TryoutRuntimeQuestion } from "@/components/tryout/runtime/question.client";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/** Cohesive render model for one loaded try-out runtime. */
export interface TryoutRuntimeValue {
  expired: boolean;
  questions: readonly TryoutQuestionContent[];
  returnHref: string;
  runtime: TryoutSectionRuntime;
}

/** Renders the active Convex-backed try-out section runtime. */
export function TryoutRuntime({ value }: { value: TryoutRuntimeValue }) {
  const { expired, questions, returnHref, runtime } = value;
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
          value={{
            expired,
            remainingSeconds,
            returnHref,
            runtime,
          }}
        />
      ) : null}

      {runtimeQuestions.map(({ content, question }) => (
        <TryoutRuntimeQuestion
          key={question.placementId}
          value={{
            content,
            locked: expired || !isActive,
            question,
            reviewMode: !isActive,
            sectionStartedAt: runtime.section.startedAt,
          }}
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

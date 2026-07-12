"use client";

import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/load";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { TryoutRuntimeControls } from "@/components/tryout/runtime/controls.client";
import { TryoutRuntimeQuestion } from "@/components/tryout/runtime/question.client";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/** Cohesive render model for one loaded try-out runtime. */
export interface TryoutRuntimeValue {
  answers: readonly TryoutAnswerContent[];
  expired: boolean;
  questions: readonly TryoutQuestionContent[];
  returnHref: string;
  runtime: TryoutSectionRuntime;
}

/** Renders the active Convex-backed try-out section runtime. */
export function TryoutRuntime({ value }: { value: TryoutRuntimeValue }) {
  const { answers, expired, questions, runtime } = value;
  const isActive = runtime.section.status === "in-progress";
  const questionBySnapshot = new Map(
    questions.map((question) => [getQuestionContentKey(question), question])
  );
  const answerBySnapshot = new Map(
    answers.map((answer) => [getQuestionContentKey(answer), answer.answer])
  );
  const runtimeQuestions = runtime.questions.map((question) => {
    const key = getQuestionContentKey(question);
    const content = questionBySnapshot.get(key);

    return {
      answer: answerBySnapshot.get(key) ?? null,
      content: content?.content ?? null,
      question,
    };
  });

  if (runtimeQuestions.some(({ content }) => content === null)) {
    return null;
  }

  if (!isActive && runtimeQuestions.some(({ answer }) => answer === null)) {
    return null;
  }

  return (
    <section className="space-y-12">
      <TryoutRuntimeActions value={value} />

      {runtimeQuestions.map(({ answer, content, question }) => (
        <TryoutRuntimeQuestion
          key={question.placementId}
          value={{
            answer,
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

/** Renders runtime controls only while the section remains active. */
function TryoutRuntimeActions({ value }: { value: TryoutRuntimeValue }) {
  const isActive = value.runtime.section.status === "in-progress";
  const remainingSeconds = useRemainingSeconds(
    value.runtime.expiresAt,
    isActive
  );

  if (!isActive) {
    return null;
  }

  return (
    <TryoutRuntimeControls
      value={{
        expired: value.expired,
        remainingSeconds,
        returnHref: value.returnHref,
        runtime: value.runtime,
      }}
    />
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

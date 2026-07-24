"use client";

import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
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
  const questionByPlacement = new Map(
    questions.map((question) => [question.placementId, question.content])
  );
  const answerByPlacement = new Map(
    answers.map((answer) => [answer.placementId, answer.answer])
  );
  const runtimeQuestions = runtime.questions.map((question) => ({
    answer: answerByPlacement.get(question.placementId) ?? null,
    content: questionByPlacement.get(question.placementId) ?? null,
    question,
  }));

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

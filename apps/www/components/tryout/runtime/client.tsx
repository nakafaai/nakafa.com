"use client";

import type { TryoutQuestionContent } from "@/components/tryout/content/model";
import { TryoutActiveQuestion } from "@/components/tryout/runtime/question.client";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/** Cohesive render model for one loaded try-out runtime. */
export interface TryoutRuntimeValue {
  expired: boolean;
  questions: readonly TryoutQuestionContent[];
  runtime: TryoutSectionRuntime;
}

/** Renders the active Convex-backed try-out section runtime. */
export function TryoutRuntime({ value }: { value: TryoutRuntimeValue }) {
  const { expired, questions, runtime } = value;
  const isActive = runtime.section.status === "in-progress";
  const questionBySnapshot = new Map(
    questions.map((question) => [getQuestionContentKey(question), question])
  );
  const runtimeQuestions = runtime.questions.map((question) => {
    const key = getQuestionContentKey(question);
    const content = questionBySnapshot.get(key);

    return {
      content: content?.content ?? null,
      question,
    };
  });

  if (runtimeQuestions.some(({ content }) => content === null)) {
    return null;
  }
  if (!isActive) {
    return null;
  }

  return (
    <section className="space-y-12">
      {runtimeQuestions.map(({ content, question }) => (
        <TryoutActiveQuestion
          content={content}
          key={question.placementId}
          locked={expired}
          question={question}
        />
      ))}
    </section>
  );
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

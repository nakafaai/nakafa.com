"use client";

import { tryoutSectionRuntimeValidator } from "@repo/backend/confect/tryouts/runtime/spec";
import { HashMap, Option, Schema } from "effect";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutActiveQuestion } from "@/components/tryout/runtime/question.client";

const TryoutRuntimeValueSchema = Schema.Struct({
  expired: Schema.Boolean,
  runtime: tryoutSectionRuntimeValidator,
});

/** Cohesive render model for one loaded try-out runtime. */
export type TryoutRuntimeValue = typeof TryoutRuntimeValueSchema.Type &
  Pick<TryoutRuntimeContent, "questions">;

/** Renders the active Convex-backed try-out section runtime. */
export function TryoutRuntime({ value }: { value: TryoutRuntimeValue }) {
  const { expired, questions, runtime } = value;
  const isActive = runtime.section.status === "in-progress";
  const questionBySnapshot = HashMap.fromIterable(
    questions.map((question) => [getQuestionContentKey(question), question])
  );
  const runtimeQuestions = runtime.questions.map((question) => {
    const key = getQuestionContentKey(question);
    const content = Option.getOrUndefined(HashMap.get(questionBySnapshot, key));

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

"use client";

import { useTryoutClock } from "@/components/tryout/clock";
import type { TryoutQuestionContent } from "@/components/tryout/content";
import { TryoutRuntimeControls } from "@/components/tryout/controls.client";
import { TryoutRuntimeQuestion } from "@/components/tryout/question.client";
import type {
  TryoutSectionRuntime,
  TryoutSectionRuntimeArgs,
} from "@/components/tryout/types";

interface TryoutRuntimeProps {
  questions: readonly TryoutQuestionContent[];
  returnHref: string;
  runtime: TryoutSectionRuntime;
  runtimeQueryArgs: TryoutSectionRuntimeArgs;
}

/** Renders the active Convex-backed try-out section runtime. */
export function TryoutRuntime({
  questions,
  returnHref,
  runtime,
  runtimeQueryArgs,
}: TryoutRuntimeProps) {
  const remainingSeconds = useRemainingSeconds(runtime.expiresAt);
  const isExpired = remainingSeconds === 0;
  const contentBySourcePath = new Map(
    questions.map((question) => [question.sourcePath, question.content])
  );

  return (
    <section className="space-y-12">
      <TryoutRuntimeControls
        isExpired={isExpired}
        remainingSeconds={remainingSeconds}
        returnHref={returnHref}
        runtime={runtime}
      />

      {runtime.questions.map((question) => (
        <TryoutRuntimeQuestion
          content={contentBySourcePath.get(question.sourcePath) ?? null}
          isExpired={isExpired}
          key={question.placementId}
          question={question}
          runtime={runtime}
          runtimeQueryArgs={runtimeQueryArgs}
          sectionStartedAt={runtime.section.startedAt}
        />
      ))}
    </section>
  );
}

/** Tracks remaining section seconds from the Convex expiry timestamp. */
function useRemainingSeconds(expiresAt: number) {
  const now = useTryoutClock(true);

  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

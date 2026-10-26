import { Array as Arr, Option } from "effect";
import { createContext, use } from "react";
import { PlayerQuestion } from "@/components/player/question";
import { PlayerQuestions } from "@/components/player/questions";
import type { TryoutRunningContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { joinTryoutBodies } from "@/components/tryout/player/model";
import { getTryoutQuestionIds } from "@/components/tryout/runtime/question/id";
import { TryoutQuestionHeader } from "@/components/tryout/runtime/question/shell";
import { TryoutResponse } from "@/components/tryout/runtime/response/input";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * The signed questions of the running section, rendered on the server, which
 * the page gives the player's articles. It holds the page's content, fixed for
 * one page, so it never changes above the streamed bodies.
 */
export const TryoutContentContext = createContext<{
  readonly content: TryoutRunningContent | null;
} | null>(null);

/**
 * Lays out the running questions with their signed bodies for the player. The
 * bodies are server component trees that arrived with the page, so every
 * question and control renders in the first HTML. Each question shows its
 * number, its signed body, and its response fields.
 */
export function TryoutArticles({
  locked,
  runtime,
}: {
  /** Answers are read-only because time ran out. */
  locked: boolean;
  runtime: TryoutSectionRuntime;
}) {
  const value = use(TryoutContentContext);
  if (value === null) {
    throw new Error("TryoutArticles must be used within TryoutContentContext");
  }
  const { content } = value;
  if (!content || content.questions.length === 0) {
    return <TryoutContentRefresh />;
  }
  const joined = joinTryoutBodies({
    bodies: content.questions,
    questions: runtime.questions,
  });
  if (Option.isNone(joined)) {
    return null;
  }

  return (
    <PlayerQuestions>
      {Arr.map(joined.value, ({ body, question }) => {
        const ids = getTryoutQuestionIds(question.questionOrder);

        return (
          <PlayerQuestion
            id={ids.article}
            key={question.placementId}
            labelledBy={ids.title}
            questionKey={question.placementId}
          >
            <TryoutQuestionHeader questionOrder={question.questionOrder} />
            <section className="my-6">{body}</section>
            <section className="my-8">
              <TryoutResponse value={{ locked, question }} />
            </section>
          </PlayerQuestion>
        );
      })}
    </PlayerQuestions>
  );
}

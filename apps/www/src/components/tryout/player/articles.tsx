import { Array as Arr, Option } from "effect";
import { use } from "react";
import { PlayerQuestionFlag } from "@/components/player/flag";
import { PlayerQuestion } from "@/components/player/question";
import { PlayerQuestions } from "@/components/player/questions";
import { TryoutContentContext } from "@/components/tryout/content/context";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { useTryoutFlag } from "@/components/tryout/player/flag";
import { joinTryoutBodies } from "@/components/tryout/player/model";
import { getTryoutQuestionIds } from "@/components/tryout/runtime/question/id";
import { TryoutQuestionHeader } from "@/components/tryout/runtime/question/shell";
import { TryoutResponse } from "@/components/tryout/runtime/response/input";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

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
  const flag = useTryoutFlag();
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
            <PlayerQuestionFlag
              flagged={question.flagged}
              locked={locked}
              onFlag={() => flag(question, !question.flagged)}
              questionKey={question.placementId}
            />
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

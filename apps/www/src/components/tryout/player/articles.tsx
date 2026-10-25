import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { PlayerQuestion } from "@/components/player/question";
import { PlayerQuestions } from "@/components/player/questions";
import type { TryoutRunningContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { joinTryoutBodies } from "@/components/tryout/player/model";
import { getTryoutQuestionIds } from "@/components/tryout/runtime/question/id";
import { TryoutQuestionHeader } from "@/components/tryout/runtime/question/shell";
import { TryoutResponse } from "@/components/tryout/runtime/response/input";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

/**
 * Lays out the running questions with their signed bodies for the player. The
 * bodies are server component trees that arrived with the page, so every
 * question and control renders in the first HTML.
 */
export function TryoutArticles({
  content,
  locked,
  runtime,
}: {
  /** The signed questions of the section, rendered on the server. */
  content: TryoutRunningContent | null;
  /** Answers are read-only because time ran out. */
  locked: boolean;
  runtime: TryoutSectionRuntime;
}) {
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
      {Arr.map(joined.value, ({ body, question }) => (
        <TryoutArticle
          body={body}
          key={question.placementId}
          locked={locked}
          question={question}
        />
      ))}
    </PlayerQuestions>
  );
}

/** One running question: its number, its signed body, and its response fields. */
function TryoutArticle({
  body,
  locked,
  question,
}: {
  body: ReactNode;
  locked: boolean;
  question: TryoutRuntimeQuestion;
}) {
  const ids = getTryoutQuestionIds(question.questionOrder);

  return (
    <PlayerQuestion
      id={ids.article}
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
}

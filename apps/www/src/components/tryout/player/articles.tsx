import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Result } from "effect";
import { PlayerQuestionFlag } from "@/components/player/flag";
import { readQuestionIds } from "@/components/player/ids";
import {
  PlayerQuestion,
  PlayerQuestionAnswer,
  PlayerQuestionHeader,
  PlayerQuestionPrompt,
} from "@/components/player/question";
import { PlayerQuestions } from "@/components/player/questions";
import { joinTryoutBodies } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import { useTryoutFlag } from "@/components/tryout/player/flag";
import { TryoutQuestionBody } from "@/components/tryout/runtime/question/body";
import { TryoutResponse } from "@/components/tryout/runtime/response/input";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * Lays out the running questions with their bodies for the player. The bodies
 * arrived with the page as data, and each question shows its number, its body
 * through the sitting's document reader, and its response fields.
 */
export function TryoutArticles({
  locked,
  runtime,
}: {
  /** Answers are read-only because time ran out. */
  locked: boolean;
  runtime: TryoutSectionRuntime;
}) {
  const value = useRequired(TryoutContentContext, "TryoutArticles");
  const flag = useTryoutFlag();
  // The page read sends the bodies with the runtime, so a question without its body is a broken read
  // for the route's error boundary, never a player without its questions.
  const joined = Result.getOrThrow(
    joinTryoutBodies(value.bodies ?? [], runtime.questions)
  );

  return (
    <PlayerQuestions>
      {Arr.map(joined, ({ body, question }) => {
        const ids = readQuestionIds(question.questionOrder);

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
            <PlayerQuestionHeader number={question.questionOrder} />
            <PlayerQuestionPrompt>
              <TryoutQuestionBody body={body} />
            </PlayerQuestionPrompt>
            <PlayerQuestionAnswer>
              <TryoutResponse
                value={{ interaction: body.interaction, locked, question }}
              />
            </PlayerQuestionAnswer>
          </PlayerQuestion>
        );
      })}
    </PlayerQuestions>
  );
}

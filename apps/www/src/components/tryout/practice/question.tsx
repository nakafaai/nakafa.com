import { QueryResult, useMutation, useQuery } from "@confect/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import practice from "@repo/backend/confect/_generated/refs/practice";
import type { QuestionResponse } from "@repo/backend/confect/assessment/parts";
import { verdictOf } from "@repo/backend/confect/assessment/verdict";
import type { TryoutQuestionBody as Body } from "@repo/backend/confect/tryouts/runtime/spec";
import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr, Effect } from "effect";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import {
  PlayerQuestion,
  PlayerQuestionAnswer,
  PlayerQuestionHeader,
  PlayerQuestionPrompt,
} from "@/components/player/question";
import { reportPracticeFailure } from "@/components/tryout/practice/failure";
import type { PracticeQuestion } from "@/components/tryout/practice/model";
import { TryoutExplanationOffer } from "@/components/tryout/review/offer";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import {
  onlyResponse,
  withPart,
} from "@/components/tryout/runtime/response/parts";
import { placeTryoutParts } from "@/components/tryout/runtime/response/place";
import { TryoutReviewedAnswer } from "@/components/tryout/runtime/response/review";

/**
 * One practice question in the player, named by its heading, holding the question as the learner meets it: open
 * (`TryoutPracticeOpen`), with Check, which grades it on the server and makes it final, or checked
 * (`TryoutPracticeChecked`), which says how it went and shows the key marked and the explanation to a reader who
 * may read them, or the Pro offer in their place.
 */
export function TryoutPracticeQuestion({
  children,
  question,
}: {
  children: ReactNode;
  question: PracticeQuestion;
}) {
  const ids = readQuestionIds(question.questionOrder);

  return (
    <PlayerQuestion
      id={ids.article}
      labelledBy={ids.title}
      questionKey={question.questionId}
    >
      {children}
    </PlayerQuestion>
  );
}

/**
 * A question not checked yet: the learner answers it, then checks it, in a transition while the server grades it. A
 * question of one interaction takes its answer below its prompt, and a question of several takes each part where its
 * prompt puts it.
 */
export function TryoutPracticeOpen({
  body,
  question,
}: {
  body: Body;
  question: PracticeQuestion;
}) {
  const t = useTranslations("Tryouts");
  const check = useMutation(practice.sessions.check);
  const [response, setResponse] = useState<QuestionResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const [only, ...later] = body.interactions;
  const id = `practice-${question.questionId}`;

  return (
    <>
      <PlayerQuestionHeader number={question.questionOrder}>
        <Button
          disabled={response === null || pending}
          onClick={() =>
            startTransition(async () => {
              if (response === null) {
                return;
              }
              await Effect.runPromise(
                Effect.tryPromise(() =>
                  check({ questionId: question.questionId, response })
                ).pipe(
                  Effect.flatMap(Effect.fromResult),
                  Effect.catch(reportPracticeFailure)
                )
              );
            })
          }
          type="button"
          variant="outline"
        >
          <Spinner icon={CheckmarkCircle02Icon} isLoading={pending} />
          {t("practice-check")}
        </Button>
      </PlayerQuestionHeader>
      {Arr.isReadonlyArrayNonEmpty(later) ? (
        <PlayerQuestionPrompt>
          <TryoutQuestionBody
            body={body}
            place={placeTryoutParts({
              id,
              interactions: body.interactions,
              locked: pending,
              onPart: (interaction, next) =>
                setResponse((current) => withPart(current, interaction, next)),
              response,
            })}
          />
        </PlayerQuestionPrompt>
      ) : (
        <>
          <PlayerQuestionPrompt>
            <TryoutQuestionBody body={body} />
          </PlayerQuestionPrompt>
          <PlayerQuestionAnswer>
            <TryoutResponseFields
              value={{
                id,
                interaction: only,
                locked: pending,
                onChange: setResponse,
                response: onlyResponse(response),
              }}
            />
          </PlayerQuestionAnswer>
        </>
      )}
    </>
  );
}

/** A checked question: how it went, the answer marked against the key when the reader may see it, and its explanation or the offer. */
export function TryoutPracticeChecked({
  answer,
  body,
  locale,
  question,
}: {
  answer: NonNullable<PracticeQuestion["answer"]>;
  body: Body;
  locale: AppLocaleCode;
  question: PracticeQuestion;
}) {
  const t = useTranslations("Tryouts");
  const explained = useQuery(practice.sessions.explain, {
    locale,
    questionId: question.questionId,
  });
  const reading = QueryResult.isSuccess(explained) ? explained.value : null;
  const id = `practice-${question.questionId}`;

  return (
    <>
      <PlayerQuestionHeader
        number={question.questionOrder}
        verdict={verdictOf(answer.grade)}
      />
      <PlayerQuestionPrompt>
        <TryoutQuestionBody body={body} />
      </PlayerQuestionPrompt>
      <PlayerQuestionAnswer>
        <TryoutReviewedAnswer
          grade={answer.grade}
          id={id}
          interactions={body.interactions}
          keys={reading?.keys}
          response={answer.response}
        />
      </PlayerQuestionAnswer>
      {QueryResult.isSuccess(explained) ? (
        <section className="space-y-6 pb-8">
          <Separator />
          <h3 className="text-lg font-medium">{t("explanation")}</h3>
          {reading === null ? (
            <TryoutExplanationOffer />
          ) : (
            <TryoutExplanationBody body={reading} />
          )}
        </section>
      ) : null}
    </>
  );
}

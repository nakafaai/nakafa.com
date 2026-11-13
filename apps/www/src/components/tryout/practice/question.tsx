import { QueryResult, useMutation, useQuery } from "@confect/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import practice from "@repo/backend/confect/_generated/refs/practice";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { verdictOf } from "@repo/backend/confect/assessment/verdict";
import type { TryoutQuestionBody as Body } from "@repo/backend/confect/tryouts/runtime/spec";
import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Effect } from "effect";
import { type ReactNode, useState, useTransition } from "react";
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
import { TryoutVerdictBadge } from "@/components/tryout/review/verdict";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import { TryoutReviewedFields } from "@/components/tryout/runtime/response/review";

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

/** A question not checked yet: the learner answers it, then checks it, in a transition while the server grades it. */
export function TryoutPracticeOpen({
  body,
  question,
}: {
  body: Body;
  question: PracticeQuestion;
}) {
  const t = useTranslations("Tryouts");
  const check = useMutation(practice.sessions.check);
  const [response, setResponse] = useState<ExamResponse | null>(null);
  const [pending, startTransition] = useTransition();

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
      <PlayerQuestionPrompt>
        <TryoutQuestionBody body={body} />
      </PlayerQuestionPrompt>
      <PlayerQuestionAnswer>
        <TryoutResponseFields
          value={{
            id: `practice-${question.questionId}`,
            interaction: body.interaction,
            locked: pending,
            onChange: setResponse,
            response,
          }}
        />
      </PlayerQuestionAnswer>
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
      <PlayerQuestionHeader number={question.questionOrder}>
        <TryoutVerdictBadge verdict={verdictOf(answer.grade)} />
      </PlayerQuestionHeader>
      <PlayerQuestionPrompt>
        <TryoutQuestionBody body={body} />
      </PlayerQuestionPrompt>
      <PlayerQuestionAnswer>
        {reading === null ? (
          <TryoutResponseFields
            value={{
              id,
              interaction: body.interaction,
              locked: true,
              onChange: () => undefined,
              response: answer.response,
            }}
          />
        ) : (
          <TryoutReviewedFields
            answer={reading.key}
            id={id}
            interaction={body.interaction}
            response={answer.response}
          />
        )}
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

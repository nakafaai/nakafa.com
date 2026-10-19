"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { Flag01Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Clock, Effect, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useSendAnswer } from "@/components/exams/sitting/answer.client";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { SittingDocument } from "@/components/exams/sitting/document";
import { useFlags } from "@/components/exams/sitting/flags.client";
import { keepAnswer } from "@/components/exams/sitting/keep";
import type { PaperQuestion } from "@/components/exams/sitting/paper";
import { choiceOf } from "@/components/exams/sitting/response";
import { sittingStorage } from "@/components/exams/sitting/storage.client";
import { PlayerQuestion } from "@/components/player/question";
import { reportClientException } from "@/lib/analytics/client";

/**
 * One question of the paper: its number, its prompt as the editor holds it now, its options, and the
 * flag that the student sets for review. A choice is kept in the browser before it is sent, so a reload
 * or a closed tab sends it again. The prompt waits while the server folds the editor's steps, and the
 * query runs again when the fold is written, so a prompt that is not ready shows nothing yet.
 */
export function SittingQuestion({
  attemptId,
  deviceId,
  question,
  sittingId,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: string;
  readonly question: PaperQuestion;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const titleId = useId();
  const articleId = useId();
  const prompt = useQuery(exams.sittings.prompt, {
    deviceId,
    questionId: question.id,
    sittingId,
    slug,
  });
  const send = useSendAnswer();
  const flagged = useFlags((state) => Arr.contains(state.flagged, question.id));
  const toggleFlag = useFlags((state) => state.toggle);
  const choice = choiceOf(question.interactions);

  /** Keeps the choice in the browser, then sends it; the send confirms or drops the kept answer. */
  function onChoose(response: readonly string[]) {
    const answeredAt = Effect.runSync(Clock.currentTimeMillis);
    Effect.runSync(
      keepAnswer(sittingId, attemptId, question.id, {
        answeredAt,
        response,
      }).pipe(
        Effect.provide(sittingStorage),
        Effect.catchTag("KeyValueStoreError", (error) =>
          reportClientException(error, {
            source: "components/exams/sitting/question",
          })
        )
      )
    );
    Effect.runPromise(
      send(
        {
          attemptId,
          deviceId,
          questionId: question.id,
          response,
          sittingId,
          slug,
        },
        answeredAt
      )
    );
  }

  return (
    <PlayerQuestion
      id={articleId}
      labelledBy={titleId}
      questionKey={question.id}
    >
      <div className="grid gap-6">
        <h2 className="font-medium" id={titleId}>
          {t("question", { number: question.number })}
        </h2>
        {/* The reader takes its document once, so a changed prompt remounts it. */}
        {QueryResult.isSuccess(prompt) ? (
          <SittingDocument
            document={Schema.decodeSync(JsonTextSchema)(prompt.value.prompt)}
            key={prompt.value.prompt}
            label={t("prompt-label")}
          />
        ) : null}
        {Option.isSome(choice) ? (
          <SittingChoice
            choice={choice.value}
            labelledBy={titleId}
            onChoose={onChoose}
            response={question.response ?? []}
          />
        ) : null}
        <div>
          <Button
            aria-pressed={flagged}
            onClick={() => toggleFlag(question.id)}
            type="button"
            variant="outline"
          >
            <HugeIcons icon={Flag01Icon} />
            {t("flag-question")}
          </Button>
        </div>
      </div>
    </PlayerQuestion>
  );
}

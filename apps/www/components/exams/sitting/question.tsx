"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { JsonTextSchema } from "@repo/utilities/json";
import { Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { runSittingCall } from "@/components/exams/sitting/actions.client";
import { useAnswer } from "@/components/exams/sitting/answer.client";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { SittingDocument } from "@/components/exams/sitting/document";
import type { PaperQuestion } from "@/components/exams/sitting/paper";
import { choiceOf } from "@/components/exams/sitting/response";

/**
 * One question of the paper: its number, its prompt as the editor holds it now, and its options.
 * The prompt waits while the server folds the editor's steps, and the query runs again when the
 * fold is written, so a prompt that is not ready shows nothing yet.
 */
export function SittingQuestion({
  deviceId,
  question,
  sittingId,
  slug,
}: {
  readonly deviceId: string;
  readonly question: PaperQuestion;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const titleId = useId();
  const prompt = useQuery(exams.sittings.prompt, {
    deviceId,
    questionId: question.id,
    sittingId,
    slug,
  });
  const answer = useAnswer();
  const choice = choiceOf(question.interactions);

  return (
    <section aria-labelledby={titleId} className="grid gap-6">
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
          onChoose={(response) =>
            runSittingCall(() =>
              answer({
                deviceId,
                questionId: question.id,
                response,
                sittingId,
                slug,
              })
            )
          }
          response={question.response ?? []}
        />
      ) : null}
    </section>
  );
}

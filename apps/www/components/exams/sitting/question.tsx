"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId, useMemo } from "react";
import { runSittingCall } from "@/components/exams/sitting/actions.client";
import { useAnswer } from "@/components/exams/sitting/answer.client";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { SittingDocument } from "@/components/exams/sitting/document";
import type { PaperQuestion } from "@/components/exams/sitting/paper";
import {
  pictureIdsOfDocuments,
  SittingPictures,
} from "@/components/exams/sitting/pictures";
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
  const choice = useMemo(
    () => choiceOf(question.interactions),
    [question.interactions]
  );
  const promptText = QueryResult.isSuccess(prompt) ? prompt.value.prompt : null;
  const promptDocument = useMemo(
    () =>
      promptText === null
        ? null
        : Schema.decodeSync(JsonTextSchema)(promptText),
    [promptText]
  );
  // The images of the prompt and of the options, resolved in one read by this student's device.
  const pictureIds = useMemo(() => {
    const labels = Option.match(choice, {
      onNone: () => [],
      onSome: (found) => Arr.map(found.options, (option) => option.label),
    });
    return pictureIdsOfDocuments(
      promptDocument === null ? labels : [promptDocument, ...labels]
    );
  }, [choice, promptDocument]);
  const pictures = useQuery(
    exams.sittings.images,
    pictureIds.length === 0
      ? "skip"
      : { assets: pictureIds, deviceId, sittingId, slug }
  );
  const addresses = useMemo(
    () =>
      QueryResult.isSuccess(pictures)
        ? Rec.fromEntries(
            Arr.map(pictures.value, (asset) => [asset.id, asset.url] as const)
          )
        : {},
    [pictures]
  );

  return (
    <section aria-labelledby={titleId} className="grid gap-6">
      <h2 className="font-medium" id={titleId}>
        {t("question", { number: question.number })}
      </h2>
      <SittingPictures value={addresses}>
        {promptDocument === null ? null : (
          // The reader takes its document once, so a changed prompt remounts it.
          <SittingDocument
            document={promptDocument}
            key={promptText}
            label={t("prompt-label")}
          />
        )}
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
      </SittingPictures>
    </section>
  );
}

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  chosenOptions,
  type ExamResponse,
  madePairs,
  markedCells,
  NO_RESPONSE,
} from "@repo/backend/confect/exams/sittings/response";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { useId, useMemo } from "react";
import { useTranslations } from "use-intl";
import {
  keepResponse,
  useChooseAnswer,
} from "@/components/exams/sitting/answer";
import { SittingChoice } from "@/components/exams/sitting/choice";
import {
  PromptReserve,
  SittingDocument,
} from "@/components/exams/sitting/document";
import { SittingField } from "@/components/exams/sitting/field";
import { useKeptText } from "@/components/exams/sitting/kept";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import { useFlagQuestion } from "@/components/exams/sitting/mark";
import { SittingPairs } from "@/components/exams/sitting/pairs";
import type { PaperQuestion } from "@/components/exams/sitting/paper";
import {
  pictureIdsOfDocuments,
  SittingPictures,
} from "@/components/exams/sitting/pictures";
import {
  choiceOf,
  pairingOf,
  tableOf,
  writtenOf,
} from "@/components/exams/sitting/response";
import { SittingTable } from "@/components/exams/sitting/table";
import { PlayerQuestionFlag } from "@/components/player/flag";
import { PlayerQuestion } from "@/components/player/question";

/**
 * One question of the paper: its number, its prompt as the editor holds it now, and its options or its
 * answer line. The player's footer flags the current question. A choice or a typed answer is kept in the
 * browser before it is sent, so a reload
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
  const choose = useChooseAnswer();
  const flagQuestion = useFlagQuestion({ deviceId, sittingId, slug });
  const locked = usePaperLocked();
  const keptText = useKeptText({ attemptId, question, sittingId });
  const choice = useMemo(
    () => choiceOf(question.interactions),
    [question.interactions]
  );
  const entry = useMemo(
    () => writtenOf(question.interactions),
    [question.interactions]
  );
  const pairing = useMemo(
    () => pairingOf(question.interactions),
    [question.interactions]
  );
  const table = useMemo(
    () => tableOf(question.interactions),
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
    const labels = Arr.appendAll(
      Option.match(choice, {
        onNone: () => [],
        onSome: (found) => Arr.map(found.options, (option) => option.label),
      }),
      Arr.appendAll(
        Option.match(pairing, {
          onNone: () => [],
          onSome: (found) =>
            Arr.map(
              Arr.appendAll(found.sources, found.targets),
              (part) => part.label
            ),
        }),
        Option.match(table, {
          onNone: () => [],
          onSome: (found) =>
            Arr.map(
              Arr.appendAll(found.statements, found.columns),
              (part) => part.label
            ),
        })
      )
    );
    return pictureIdsOfDocuments(
      promptDocument === null ? labels : [promptDocument, ...labels]
    );
  }, [choice, pairing, promptDocument, table]);
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

  /** Keeps the choice or the typed text in the browser, then sends it, numbered one above the saved version. */
  function onChoose(response: ExamResponse) {
    choose({ attemptId, deviceId, question, response, sittingId, slug });
  }

  return (
    <PlayerQuestion
      id={articleId}
      labelledBy={titleId}
      questionKey={question.id}
    >
      <PlayerQuestionFlag
        flagged={question.flagged}
        locked={locked}
        onFlag={() => flagQuestion(question)}
        questionKey={question.id}
      />
      <div className="grid gap-6">
        <h2 className="font-medium" id={titleId}>
          {t("question", { number: question.number })}
        </h2>
        <SittingPictures value={addresses}>
          {promptDocument === null && !QueryResult.isSuccess(prompt) ? (
            <PromptReserve />
          ) : null}
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
              onChoose={onChoose}
              response={chosenOptions(question.response ?? NO_RESPONSE)}
            />
          ) : null}
          {Option.isSome(entry) ? (
            <SittingField
              entry={entry.value}
              labelledBy={titleId}
              onKeep={(text) =>
                keepResponse({
                  attemptId,
                  question,
                  response: { text },
                  sittingId,
                })
              }
              onType={(text) => onChoose({ text })}
              text={keptText}
            />
          ) : null}
          {Option.isSome(pairing) ? (
            <SittingPairs
              labelledBy={titleId}
              match={pairing.value}
              onPair={(pairs) => onChoose({ pairs })}
              pairs={madePairs(question.response ?? NO_RESPONSE)}
            />
          ) : null}
          {Option.isSome(table) ? (
            <SittingTable
              cells={markedCells(question.response ?? NO_RESPONSE)}
              onMark={(cells) => onChoose({ cells })}
              table={table.value}
            />
          ) : null}
        </SittingPictures>
      </div>
    </PlayerQuestion>
  );
}

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  chosenOptions,
  type ExamResponse,
  madePairs,
  markedCells,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/assessment/response";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Option, Schema } from "effect";
import { memo, type ReactNode, useMemo } from "react";
import {
  keepResponse,
  useChooseAnswer,
} from "@/components/exams/sitting/answer";
import { SittingChoice } from "@/components/exams/sitting/choice";
import {
  ReaderPrimer,
  SittingDocument,
} from "@/components/exams/sitting/document";
import { SittingField } from "@/components/exams/sitting/field";
import { useKeptText } from "@/components/exams/sitting/kept";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import { useFlagQuestion } from "@/components/exams/sitting/mark";
import { PaperMedia } from "@/components/exams/sitting/media";
import { SittingPairs } from "@/components/exams/sitting/pairs";
import type {
  PaperQuestion,
  PaperValue,
} from "@/components/exams/sitting/paper";
import {
  addressesOf,
  partLabels,
  pictureIdsOfDocuments,
  SittingPictures,
} from "@/components/exams/sitting/pictures";
import { SittingReason } from "@/components/exams/sitting/reason";
import {
  choiceOf,
  pairingOf,
  reasonOf,
  tableOf,
  writtenOf,
} from "@/components/exams/sitting/response";
import { SittingTable } from "@/components/exams/sitting/table";
import { PlayerQuestionFlag } from "@/components/player/flag";
import {
  HeldPaper,
  usePaperText,
  usePaperTurn,
} from "@/components/player/held";
import { readQuestionIds } from "@/components/player/ids";
import { usePlayer } from "@/components/player/provider";
import {
  PlayerQuestion,
  PlayerQuestionAnswer,
  PlayerQuestionHeader,
  PlayerQuestionPrompt,
} from "@/components/player/question";

/**
 * The paper of a sitting, out of sight until it can draw its first screen: the reader has loaded, and the prompts
 * of its first questions have answered. So the student meets the paper whole, as the try-out shows its questions,
 * and no option moves when its prompt arrives. A prompt that cannot be read yet answers too, with the failure that
 * the question shows as nothing.
 */
export function PaperReveal({
  children,
  paper,
}: {
  readonly children: ReactNode;
  readonly paper: PaperValue;
}) {
  return (
    <HeldPaper
      keys={Arr.map(paper.questions, (question) => question.id)}
      primer={<ReaderPrimer />}
    >
      {children}
    </HeldPaper>
  );
}

/** The images of the prompt and of the options, resolved in one read by this student's device. */
function useQuestionPictures({
  deviceId,
  interactions,
  promptDocument,
  readingDocument,
  sittingId,
  slug,
}: {
  readonly deviceId: string;
  readonly interactions: PaperQuestion["interactions"];
  readonly promptDocument: unknown;
  readonly readingDocument: unknown;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const pictureIds = useMemo(
    () =>
      pictureIdsOfDocuments(
        Arr.filter(
          [promptDocument, readingDocument, ...partLabels(interactions)],
          (document) => document !== null
        )
      ),
    [interactions, promptDocument, readingDocument]
  );
  const pictures = useQuery(
    exams.sittings.images,
    pictureIds.length === 0
      ? "skip"
      : { assets: pictureIds, deviceId, sittingId, slug }
  );

  return useMemo(
    () => (QueryResult.isSuccess(pictures) ? addressesOf(pictures.value) : {}),
    [pictures]
  );
}

/** The prompt and the reading of a question as documents, or null while the prompt is not ready. */
function usePromptDocuments(prompt: ReturnType<typeof usePromptRead>) {
  const promptText = QueryResult.isSuccess(prompt) ? prompt.value.prompt : null;
  const readingText = QueryResult.isSuccess(prompt)
    ? prompt.value.reading
    : null;
  const readingDocument = useMemo(
    () =>
      readingText === null
        ? null
        : Schema.decodeSync(JsonTextSchema)(readingText),
    [readingText]
  );
  const promptDocument = useMemo(
    () =>
      promptText === null
        ? null
        : Schema.decodeSync(JsonTextSchema)(promptText),
    [promptText]
  );

  return { promptDocument, readingDocument };
}

/**
 * The read of one question's prompt for this student's device, once its turn comes, and at once for the question the
 * student stands on. The paper hears when the prompt can draw.
 */
function usePromptRead({
  deviceId,
  questionId,
  sittingId,
  slug,
}: {
  readonly deviceId: string;
  readonly questionId: PaperQuestion["id"];
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const current = usePlayer((state) => state.current === questionId);
  const turn = usePaperTurn(questionId, current);
  const prompt = useQuery(
    exams.sittings.prompt,
    turn ? { deviceId, questionId, sittingId, slug } : "skip"
  );
  usePaperText(questionId, turn && !QueryResult.isLoading(prompt));

  return prompt;
}

/**
 * One question of the paper: its number, its prompt as the editor holds it now, and its options or its
 * answer line. The player's footer flags the current question. A choice or a typed answer is kept in the
 * browser before it is sent, so a reload
 * or a closed tab sends it again. It draws again only when the paper's merge gives it a new question, so an
 * answer redraws its own question. The prompt waits while the server folds the editor's steps, and the
 * query runs again when the fold is written, so a prompt that is not ready shows nothing yet.
 */
export const SittingQuestion = memo(function SittingQuestion({
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
  const ids = readQuestionIds(question.number);
  const prompt = usePromptRead({
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
  const reasons = useMemo(
    () => reasonOf(question.interactions),
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
  const { promptDocument, readingDocument } = usePromptDocuments(prompt);
  const addresses = useQuestionPictures({
    deviceId,
    interactions: question.interactions,
    promptDocument,
    readingDocument,
    sittingId,
    slug,
  });

  /** Keeps the choice or the typed text in the browser, then sends it, numbered one above the saved version. */
  function onChoose(response: ExamResponse) {
    choose({ attemptId, deviceId, question, response, sittingId, slug });
  }

  return (
    <PlayerQuestion
      id={ids.article}
      labelledBy={ids.title}
      questionKey={question.id}
    >
      <PlayerQuestionFlag
        flagged={question.flagged}
        locked={locked}
        onFlag={() => flagQuestion(question)}
        questionKey={question.id}
      />
      <PlayerQuestionHeader number={question.number} />
      <SittingPictures value={addresses}>
        <PlayerQuestionPrompt>
          <div className="grid gap-6">
            {QueryResult.isSuccess(prompt) ? (
              <PaperMedia items={prompt.value.media} />
            ) : null}
            {readingDocument === null ? null : (
              <SittingDocument document={readingDocument} />
            )}
            {promptDocument === null ? null : (
              <SittingDocument document={promptDocument} />
            )}
          </div>
        </PlayerQuestionPrompt>
        <PlayerQuestionAnswer>
          {Option.isSome(choice) ? (
            <SittingChoice
              choice={choice.value}
              labelledBy={ids.title}
              onChoose={onChoose}
              response={chosenOptions(question.response ?? NO_RESPONSE)}
            />
          ) : null}
          {Option.isSome(reasons) ? (
            <SittingReason
              answer={reasons.value[0]}
              onChoose={onChoose}
              reason={reasons.value[1]}
              response={chosenOptions(question.response ?? NO_RESPONSE)}
            />
          ) : null}
          {Option.isSome(entry) ? (
            <SittingField
              entry={entry.value}
              labelledBy={ids.title}
              onKeep={(text) =>
                keepResponse({
                  attemptId,
                  question,
                  response: { text },
                  sittingId,
                })
              }
              onType={(text) => onChoose({ text })}
              saved={typedText(question.response ?? NO_RESPONSE)}
              text={keptText}
            />
          ) : null}
          {Option.isSome(pairing) ? (
            <SittingPairs
              labelledBy={ids.title}
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
        </PlayerQuestionAnswer>
      </SittingPictures>
    </PlayerQuestion>
  );
});

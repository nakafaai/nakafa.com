import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  chosenOptions,
  type ExamResponse,
  madePairs,
  markedCells,
  NO_RESPONSE,
} from "@repo/backend/confect/assessment/response";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { memo, type ReactNode, useMemo } from "react";
import {
  keepResponse,
  useChooseAnswer,
} from "@/components/exams/sitting/answer";
import { SittingChoice } from "@/components/exams/sitting/choice";
import {
  SittingDocument,
  useReaderLoaded,
} from "@/components/exams/sitting/document";
import { SittingField } from "@/components/exams/sitting/field";
import { useKeptText } from "@/components/exams/sitting/kept";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import { useFlagQuestion } from "@/components/exams/sitting/mark";
import { SittingPairs } from "@/components/exams/sitting/pairs";
import type {
  PaperQuestion,
  PaperValue,
} from "@/components/exams/sitting/paper";
import {
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
import { readQuestionIds } from "@/components/player/ids";
import {
  PlayerQuestion,
  PlayerQuestionAnswer,
  PlayerQuestionHeader,
  PlayerQuestionPrompt,
} from "@/components/player/question";

/**
 * Keeps the paper out of sight until it can draw its first question: the reader has loaded, and the first
 * prompt has answered, as the prompts of a paper answer together. So the student meets the paper whole, as the
 * try-out shows its questions, and no option moves when its prompt arrives. A prompt that cannot be read yet
 * answers too, with the failure that the question shows as nothing.
 */
export function PaperReveal({
  children,
  deviceId,
  paper,
  sittingId,
  slug,
}: {
  readonly children: ReactNode;
  readonly deviceId: string;
  readonly paper: PaperValue;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const loaded = useReaderLoaded(true);
  const first = Arr.head(paper.questions);
  const prompt = useQuery(
    exams.sittings.prompt,
    Option.isSome(first)
      ? { deviceId, questionId: first.value.id, sittingId, slug }
      : "skip"
  );

  return (
    <div
      className={
        loaded && !QueryResult.isLoading(prompt) ? undefined : "invisible"
      }
    >
      {children}
    </div>
  );
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
      Arr.flatMap(question.interactions, (interaction) =>
        interaction.kind === "choice"
          ? Arr.map(interaction.options, (option) => option.label)
          : []
      ),
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
  }, [question.interactions, pairing, promptDocument, table]);
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
          {promptDocument === null ? null : (
            <SittingDocument document={promptDocument} />
          )}
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

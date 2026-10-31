import { QueryResult, useQuery } from "@confect/react";
import editors from "@repo/backend/confect/_generated/refs/editor";
import {
  chosenOptions,
  madePairs,
  markedCells,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/assessment/response";
import { paperAnswers } from "@repo/backend/confect/exams/parts";
import { ClientOnly } from "@tanstack/react-router";
import { Option, Record as Rec } from "effect";
import { lazy, type ReactNode, Suspense } from "react";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { useReaderLoaded } from "@/components/exams/sitting/document";
import { SittingField } from "@/components/exams/sitting/field";
import { SittingPairs } from "@/components/exams/sitting/pairs";
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
import { ExamPaperMedia } from "@/components/tenant/exams/media";
import type { Question } from "@/components/tenant/exams/optimistic";
import { useExamTry, useTrySlug } from "@/components/tenant/exams/try/context";
import { useLastValue } from "@/lib/data/kept";

/** The session name the try reads prompts under. It never writes, so the server records nothing. */
const TRY_CLIENT = "try";

/**
 * The prompt loads once its document has opened, with the editor's schema and the fold that
 * applies the steps, so the try's first page carries neither (the editor's prompt does the same).
 */
const TryPrompt = lazy(() =>
  import("@/components/tenant/exams/try/prompt").then((module) => ({
    default: module.TryPrompt,
  }))
);

/**
 * Keeps the paper out of sight until it can draw its first question, as a sitting's paper does: the reader
 * has loaded, and the first prompt has answered, so no option moves when its prompt arrives.
 */
export function TryReveal({
  children,
  documentId,
}: {
  children: ReactNode;
  /** The prompt of the first question. */
  documentId: Question["prompt"] | undefined;
}) {
  const slug = useTrySlug();
  const loaded = useReaderLoaded(true);
  const reply = useQuery(
    editors.documents.open,
    documentId === undefined
      ? "skip"
      : { clientId: TRY_CLIENT, documentId, slug }
  );
  const waiting =
    !loaded || (documentId !== undefined && QueryResult.isLoading(reply));

  return <div className={waiting ? "invisible" : undefined}>{children}</div>;
}

/**
 * One question as a student meets it, in the player's own question article: its number, its prompt,
 * and its options, with the same controls as the paper of a sitting. The options are answered in the browser only, through the
 * try's own answers, so nothing is sent.
 */
export function ExamTryQuestion({
  number,
  question,
}: {
  number: number;
  question: Question;
}) {
  const ids = readQuestionIds(number);
  const response = useExamTry((state) => state.responses[question.id]);
  const choose = useExamTry((state) => state.choose);
  const flag = useExamTry((state) => state.flag);
  const flagged = useExamTry((state) => Rec.has(state.flags, question.id));
  // The try shows the paper a student would meet, which leaves out every part that shows nothing.
  const answers = paperAnswers(question.answers);
  const choice = choiceOf(answers);
  const reasons = reasonOf(answers);
  const entry = writtenOf(answers);
  const pairing = pairingOf(answers);
  const table = tableOf(answers);

  return (
    <PlayerQuestion
      id={ids.article}
      labelledBy={ids.title}
      questionKey={question.id}
    >
      <PlayerQuestionFlag
        flagged={flagged}
        locked={false}
        onFlag={() => flag(question.id)}
        questionKey={question.id}
      />
      <PlayerQuestionHeader number={number} />
      <PlayerQuestionPrompt>
        <div className="grid gap-6">
          <ExamPaperMedia question={question} />
          {question.reading === null ? null : (
            <ExamTryPrompt documentId={question.reading} />
          )}
          <ExamTryPrompt documentId={question.prompt} />
        </div>
      </PlayerQuestionPrompt>
      <PlayerQuestionAnswer>
        {Option.isSome(choice) ? (
          <SittingChoice
            choice={choice.value}
            labelledBy={ids.title}
            onChoose={(next) => choose(question.id, next)}
            response={chosenOptions(response ?? NO_RESPONSE)}
          />
        ) : null}
        {Option.isSome(reasons) ? (
          <SittingReason
            answer={reasons.value[0]}
            onChoose={(next) => choose(question.id, next)}
            reason={reasons.value[1]}
            response={chosenOptions(response ?? NO_RESPONSE)}
          />
        ) : null}
        {Option.isSome(entry) ? (
          <SittingField
            entry={entry.value}
            labelledBy={ids.title}
            onType={(text) => choose(question.id, { text })}
            text={typedText(response ?? NO_RESPONSE)}
          />
        ) : null}
        {Option.isSome(pairing) ? (
          <SittingPairs
            labelledBy={ids.title}
            match={pairing.value}
            onPair={(pairs) => choose(question.id, { pairs })}
            pairs={madePairs(response ?? NO_RESPONSE)}
          />
        ) : null}
        {Option.isSome(table) ? (
          <SittingTable
            cells={markedCells(response ?? NO_RESPONSE)}
            onMark={(cells) => choose(question.id, { cells })}
            table={table.value}
          />
        ) : null}
      </PlayerQuestionAnswer>
    </PlayerQuestion>
  );
}

/**
 * The prompt of one question. The paper shows once its first prompt can draw, as a sitting's paper
 * does, so the options below it do not move while the document opens and the reader loads. A prompt
 * that does not open leaves no space, and one whose exam goes while it is tried keeps the text it
 * showed, as the paper keeps the exam's title and questions.
 */
function ExamTryPrompt({ documentId }: { documentId: Question["prompt"] }) {
  const slug = useTrySlug();
  const reply = useQuery(editors.documents.open, {
    clientId: TRY_CLIENT,
    documentId,
    slug,
  });
  const opened = useLastValue(reply);

  if (Option.isNone(opened)) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <ClientOnly fallback={null}>
        <TryPrompt key={documentId} opened={opened.value} />
      </ClientOnly>
    </Suspense>
  );
}

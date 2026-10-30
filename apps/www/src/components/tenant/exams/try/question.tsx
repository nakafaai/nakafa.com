import { QueryResult, useQuery } from "@confect/react";
import editors from "@repo/backend/confect/_generated/refs/editor";
import {
  chosenOptions,
  madePairs,
  markedCells,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/exams/sittings/response";
import { ClientOnly } from "@tanstack/react-router";
import { Option } from "effect";
import { lazy, Suspense, useId } from "react";
import { useTranslations } from "use-intl";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { PromptReserve } from "@/components/exams/sitting/document";
import { SittingField } from "@/components/exams/sitting/field";
import { SittingPairs } from "@/components/exams/sitting/pairs";
import {
  choiceOf,
  pairingOf,
  tableOf,
  writtenOf,
} from "@/components/exams/sitting/response";
import { SittingTable } from "@/components/exams/sitting/table";
import type { Question } from "@/components/tenant/exams/optimistic";
import { useExamTry, useTrySlug } from "@/components/tenant/exams/try/context";

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
 * One question as a student meets it: its number, its prompt, and its options, with the same
 * controls as the paper of a sitting. The options are answered in the browser only, through the
 * try's own answers, so nothing is sent.
 */
export function ExamTryQuestion({
  number,
  question,
}: {
  number: number;
  question: Question;
}) {
  const t = useTranslations("Exams");
  const titleId = useId();
  const response = useExamTry((state) => state.responses[question.id]);
  const choose = useExamTry((state) => state.choose);
  const choice = choiceOf(question.answers);
  const entry = writtenOf(question.answers);
  const pairing = pairingOf(question.answers);
  const table = tableOf(question.answers);

  return (
    <section aria-labelledby={titleId} className="grid gap-6">
      <h2 className="font-medium" id={titleId}>
        {t("question", { number })}
      </h2>
      <ExamTryPrompt documentId={question.prompt} />
      {Option.isSome(choice) ? (
        <SittingChoice
          choice={choice.value}
          labelledBy={titleId}
          onChoose={(next) => choose(question.id, next)}
          response={chosenOptions(response ?? NO_RESPONSE)}
        />
      ) : null}
      {Option.isSome(entry) ? (
        <SittingField
          entry={entry.value}
          labelledBy={titleId}
          onType={(text) => choose(question.id, { text })}
          text={typedText(response ?? NO_RESPONSE)}
        />
      ) : null}
      {Option.isSome(pairing) ? (
        <SittingPairs
          labelledBy={titleId}
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
    </section>
  );
}

/**
 * The prompt of one question. It keeps a prompt's height from the first draw until its reader is
 * ready, as a sitting's prompt does, so the options below it do not move while the document opens
 * and the reader loads. A prompt that does not open leaves no space.
 */
function ExamTryPrompt({ documentId }: { documentId: Question["prompt"] }) {
  const slug = useTrySlug();
  const reply = useQuery(editors.documents.open, {
    clientId: TRY_CLIENT,
    documentId,
    slug,
  });

  if (QueryResult.isFailure(reply)) {
    return null;
  }
  if (!QueryResult.isSuccess(reply)) {
    return <PromptReserve />;
  }
  return (
    <Suspense fallback={<PromptReserve />}>
      <ClientOnly fallback={<PromptReserve />}>
        <TryPrompt key={documentId} opened={reply.value} />
      </ClientOnly>
    </Suspense>
  );
}

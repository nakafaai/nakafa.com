"use client";

import { QueryResult, useQuery } from "@confect/react";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import type { OpenedDocument } from "@repo/backend/confect/editor/view";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { SittingDocument } from "@/components/exams/sitting/document";
import { choiceOf } from "@/components/exams/sitting/response";
import type { Question } from "@/components/tenant/exams/optimistic";
import { useExamTry, useTrySlug } from "@/components/tenant/exams/try/context";
import { assessmentSchema } from "@/lib/editor/assessment";
import { readDocument, settleSteps } from "@/lib/editor/settle";

/** The session name the try reads prompts under. It never writes, so the server records nothing. */
const TRY_CLIENT = "try";

/**
 * The prompt of a question as the editor holds it now, as JSON text the way a sitting's prompt
 * arrives: the snapshot that the editor opened, with the steps after it applied by the rule that
 * the server's fold uses (ADR 0028), so the try shows the text a student would read. A snapshot
 * that the schema refuses fails with `SyncFailed`.
 */
const promptOf = Effect.fn("exams.try.prompt")(function* (
  opened: typeof OpenedDocument.Type
) {
  const document = yield* readDocument(
    assessmentSchema,
    opened.snapshot.content
  );
  const settled = yield* settleSteps(assessmentSchema, document, opened.steps);
  return encodeJsonText(settled.doc.toJSON());
});

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
  const slug = useTrySlug();
  const titleId = useId();
  const reply = useQuery(editors.documents.open, {
    clientId: TRY_CLIENT,
    documentId: question.prompt,
    slug,
  });
  const response = useExamTry((state) => state.responses[question.id]);
  const choose = useExamTry((state) => state.choose);
  const choice = choiceOf(question.answers);
  // A full page of steps may stop short of the document's head, so the prompt waits rather than
  // showing older text, as a student's prompt waits for the fold (ADR 0028).
  const prompt =
    QueryResult.isSuccess(reply) && reply.value.steps.length < STEP_PAGE_STEPS
      ? Effect.runSync(
          promptOf(reply.value).pipe(
            Effect.asSome,
            Effect.catchTag("SyncFailed", () => Effect.succeedNone)
          )
        )
      : Option.none();

  return (
    <section aria-labelledby={titleId} className="grid gap-6">
      <h2 className="font-medium" id={titleId}>
        {t("question", { number })}
      </h2>
      {Option.isSome(prompt) ? (
        <SittingDocument
          document={Schema.decodeSync(JsonTextSchema)(prompt.value)}
          key={prompt.value}
          label={t("prompt-label")}
        />
      ) : null}
      {Option.isSome(choice) ? (
        <SittingChoice
          choice={choice.value}
          labelledBy={titleId}
          onChoose={(next) => choose(question.id, next)}
          response={response ?? []}
        />
      ) : null}
    </section>
  );
}

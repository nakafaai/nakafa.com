"use client";

import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import type { OpenedDocument } from "@repo/backend/confect/editor/view";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { SittingDocument } from "@/components/exams/sitting/document";
import { assessmentSchema } from "@/lib/editor/assessment";
import { readDocument, settleSteps } from "@/lib/editor/settle";

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
 * The prompt of one question, read-only, as a student reads it. A full page of steps may stop
 * short of the document's head, so the prompt waits rather than showing older text, as a
 * student's prompt waits for the fold (ADR 0028). A prompt the schema refuses shows nothing.
 */
export function TryPrompt({ opened }: { opened: typeof OpenedDocument.Type }) {
  const t = useTranslations("Exams");
  const prompt =
    opened.steps.length < STEP_PAGE_STEPS
      ? Effect.runSync(
          promptOf(opened).pipe(
            Effect.asSome,
            Effect.catchTag("SyncFailed", () => Effect.succeedNone)
          )
        )
      : Option.none();

  return Option.isSome(prompt) ? (
    <SittingDocument
      document={Schema.decodeSync(JsonTextSchema)(prompt.value)}
      key={prompt.value}
      label={t("prompt-label")}
    />
  ) : null;
}

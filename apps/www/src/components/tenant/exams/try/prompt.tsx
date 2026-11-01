import type { OpenedDocument } from "@repo/backend/confect/editor/view";
import { Effect, Option } from "effect";
import { useMemo } from "react";
import { SittingDocument } from "@/components/exams/sitting/document";
import { tryPrompt } from "@/components/tenant/exams/try/fold";
import { TryPictures } from "@/components/tenant/exams/try/pictures";

/**
 * The prompt of one question, read-only, as a student reads it, and nothing until its document opens. The fold
 * runs once for each opened value, and the reader draws again when the head of the document moves (see `tryPrompt`).
 */
export function TryPrompt({
  opened,
}: {
  opened: typeof OpenedDocument.Type | undefined;
}) {
  const prompt = useMemo(
    () =>
      opened === undefined ? Option.none() : Effect.runSync(tryPrompt(opened)),
    [opened]
  );

  return Option.isSome(prompt) ? (
    <TryPictures documents={[prompt.value]}>
      <SittingDocument document={prompt.value} />
    </TryPictures>
  ) : null;
}

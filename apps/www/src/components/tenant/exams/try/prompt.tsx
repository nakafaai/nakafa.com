import type { OpenedDocument } from "@repo/backend/confect/editor/view";
import { Effect, Option } from "effect";
import { useMemo } from "react";
import { useTranslations } from "use-intl";
import { SittingDocument } from "@/components/exams/sitting/document";
import { tryPrompt } from "@/components/tenant/exams/try/fold";

/**
 * The prompt of one question, read-only, as a student reads it. The fold runs once for each opened
 * value, and the reader remounts when the head of the document moves (see `tryPrompt`).
 */
export function TryPrompt({ opened }: { opened: typeof OpenedDocument.Type }) {
  const t = useTranslations("Exams");
  const prompt = useMemo(() => Effect.runSync(tryPrompt(opened)), [opened]);

  return Option.isSome(prompt) ? (
    <SittingDocument
      document={prompt.value.document}
      key={prompt.value.key}
      label={t("prompt-label")}
    />
  ) : null;
}

import { useDebouncedCallback } from "@mantine/hooks";
import {
  ESSAY_RESPONSE_MAX,
  TEXT_RESPONSE_MAX,
} from "@repo/backend/confect/exams/sittings/response";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useTranslations } from "use-intl";
import type { Written } from "@/components/exams/sitting/response";

/** How long the student pauses typing before the answer is saved. */
const TYPING_PAUSE_MILLISECONDS = 800;

/** The longest the answer waits while the student keeps typing, so a long answer is saved as it grows. */
const TYPING_WAIT_MILLISECONDS = 4000;

/** The lines an essay's area opens with, as a paper leaves room for a few paragraphs. */
const ESSAY_ROWS = 8;

/**
 * The answer field of a short answer or an essay: one line the student types a short answer on, or an
 * area the student writes an essay in, as a paper exam leaves room to write. The field shows each key at
 * once and saves the text once the student pauses, leaves the field, or leaves the question, so a typed
 * answer is not one save per key.
 */
export function SittingField({
  disabled = false,
  entry,
  labelledBy,
  onType,
  text,
}: {
  readonly disabled?: boolean;
  readonly entry: Written;
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  readonly onType: (text: string) => void;
  /** The text the paper holds for the question when the field opens. */
  readonly text: string;
}) {
  const t = useTranslations("Exams");
  const save = useDebouncedCallback(onType, {
    delay: TYPING_PAUSE_MILLISECONDS,
    flushOnUnmount: true,
    maxWait: TYPING_WAIT_MILLISECONDS,
  });

  if (entry.kind === "extendedText") {
    return (
      <Textarea
        aria-labelledby={labelledBy}
        defaultValue={text}
        disabled={disabled}
        maxLength={ESSAY_RESPONSE_MAX}
        name={entry.id}
        onBlur={() => save.flush()}
        onChange={(event) => save(event.currentTarget.value)}
        placeholder={t("essay-placeholder")}
        rows={ESSAY_ROWS}
      />
    );
  }

  return (
    <Input
      aria-labelledby={labelledBy}
      autoComplete="off"
      defaultValue={text}
      disabled={disabled}
      maxLength={TEXT_RESPONSE_MAX}
      name={entry.id}
      onBlur={() => save.flush()}
      onChange={(event) => save(event.currentTarget.value)}
      placeholder={t("short-placeholder")}
      spellCheck={false}
    />
  );
}

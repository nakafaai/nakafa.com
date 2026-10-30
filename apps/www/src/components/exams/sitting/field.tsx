import { useDebouncedCallback, useWindowEvent } from "@mantine/hooks";
import {
  ESSAY_RESPONSE_MAX,
  TEXT_RESPONSE_MAX,
} from "@repo/backend/confect/exams/sittings/response";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useTranslations } from "use-intl";
import { usePaperLocked } from "@/components/exams/sitting/lock";
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
 * once and keeps the text in the browser on every key, then sends it once the student pauses, leaves the
 * field, leaves the question, or the page hides or closes, so a typed answer is not one save per key and a
 * reload or a closed tab loses no key.
 */
export function SittingField({
  entry,
  labelledBy,
  onKeep,
  onType,
  text,
}: {
  readonly entry: Written;
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  /** Keeps the text in the browser until the server confirms it. */
  readonly onKeep: (text: string) => void;
  /** Sends the text. */
  readonly onType: (text: string) => void;
  /** The text the field opens with: the kept text the server has not confirmed, else the saved text. */
  readonly text: string;
}) {
  const disabled = usePaperLocked();
  const t = useTranslations("Exams");
  const save = useDebouncedCallback(onType, {
    delay: TYPING_PAUSE_MILLISECONDS,
    flushOnUnmount: true,
    maxWait: TYPING_WAIT_MILLISECONDS,
  });
  // A page that hides or closes unmounts nothing, so it sends the text waiting for a pause at once.
  useWindowEvent("pagehide", () => save.flush());
  useWindowEvent("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      save.flush();
    }
  });

  /** Keeps every key at once, and sends the text after a pause. */
  function write(value: string) {
    onKeep(value);
    save(value);
  }

  if (entry.kind === "extendedText") {
    return (
      <Textarea
        aria-labelledby={labelledBy}
        defaultValue={text}
        disabled={disabled}
        maxLength={ESSAY_RESPONSE_MAX}
        name={entry.id}
        onBlur={() => save.flush()}
        onChange={(event) => write(event.currentTarget.value)}
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
      onChange={(event) => write(event.currentTarget.value)}
      placeholder={t("short-placeholder")}
      spellCheck={false}
    />
  );
}

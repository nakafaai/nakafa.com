import {
  useDebouncedCallback,
  useDidUpdate,
  useWindowEvent,
} from "@mantine/hooks";
import {
  ESSAY_RESPONSE_MAX,
  TEXT_RESPONSE_MAX,
} from "@repo/backend/confect/assessment/response";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { useRef } from "react";
import { useTranslations } from "use-intl";
import { SittingKeypad } from "@/components/exams/sitting/keypad";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import type { Written } from "@/components/exams/sitting/response";

/** How long the student pauses typing before the answer is saved. */
const TYPING_PAUSE_MILLISECONDS = 800;

/** The longest the answer waits while the student keeps typing, so a long answer is saved as it grows. */
const TYPING_WAIT_MILLISECONDS = 4000;

/** The lines an essay's area opens with, as a paper leaves room for a few paragraphs. */
const ESSAY_ROWS = 8;

/**
 * The answer field of a short answer, a numeric answer or an essay: one line the student types a short
 * answer on, one line for a number with its unit beside it, or an area the student writes an essay in, as a
 * paper exam leaves room to write. The field shows each key at
 * once and keeps the text in the browser on every key, then sends it once the student pauses, leaves the
 * field, leaves the question, or the page hides or closes, so a typed answer is not one save per key and a
 * reload or a closed tab loses no key. Words saved from another tab take the field's place unless the
 * student is typing here, so a later key never writes over words the field did not show. The Arabic keypad
 * beside the field types an Arabic answer with its harakat, and the field follows the direction of the
 * words the student writes.
 */
export function SittingField({
  entry,
  labelledBy,
  onKeep,
  onType,
  saved,
  text,
}: {
  readonly entry: Written;
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  /**
   * Keeps the text in the browser until the server confirms it. A teacher's try of the paper sends nothing
   * to a server, so it keeps nothing.
   */
  readonly onKeep?: (text: string) => void;
  /** Sends the text. */
  readonly onType: (text: string) => void;
  /** The text the server holds now, which a save from another tab changes. */
  readonly saved: string;
  /** The text the field opens with: the kept text the server has not confirmed, else the saved text. */
  readonly text: string;
}) {
  const disabled = usePaperLocked();
  const t = useTranslations("Exams");
  const area = useRef<HTMLTextAreaElement>(null);
  const line = useRef<HTMLInputElement>(null);
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

  // The field takes its text once, so a save from elsewhere reaches it here. The page's own save only
  // repeats what the field shows.
  useDidUpdate(() => {
    const field = area.current ?? line.current;
    if (field !== null && field !== document.activeElement) {
      field.value = saved;
    }
  }, [saved]);

  /** Keeps every key at once, and sends the text after a pause. */
  function write(value: string) {
    onKeep?.(value);
    save(value);
  }

  if (entry.kind === "extendedText") {
    return (
      <InputGroup data-disabled={disabled}>
        <InputGroupTextarea
          aria-labelledby={labelledBy}
          defaultValue={text}
          dir="auto"
          disabled={disabled}
          maxLength={ESSAY_RESPONSE_MAX}
          name={entry.id}
          onBlur={() => save.flush()}
          onChange={(event) => write(event.currentTarget.value)}
          placeholder={t("essay-placeholder")}
          ref={area}
          rows={ESSAY_ROWS}
        />
        <InputGroupAddon align="block-end" className="justify-end">
          <SittingKeypad field={area} keys="letters" />
        </InputGroupAddon>
      </InputGroup>
    );
  }

  if (entry.kind === "numericEntry") {
    // A phone opens its number pad for the field, and the keypad beside it writes Arabic-Indic digits, which
    // the server reads as the same number, with either decimal point.
    return (
      <InputGroup data-disabled={disabled}>
        <InputGroupInput
          aria-labelledby={labelledBy}
          autoComplete="off"
          defaultValue={text}
          dir="auto"
          disabled={disabled}
          inputMode="decimal"
          maxLength={TEXT_RESPONSE_MAX}
          name={entry.id}
          onBlur={() => save.flush()}
          onChange={(event) => write(event.currentTarget.value)}
          placeholder={t("number-placeholder")}
          ref={line}
          spellCheck={false}
        />
        <InputGroupAddon align="inline-end">
          {entry.unit === undefined ? null : (
            <InputGroupText>{entry.unit}</InputGroupText>
          )}
          <SittingKeypad field={line} keys="digits" />
        </InputGroupAddon>
      </InputGroup>
    );
  }

  return (
    <InputGroup data-disabled={disabled}>
      <InputGroupInput
        aria-labelledby={labelledBy}
        autoComplete="off"
        defaultValue={text}
        dir="auto"
        disabled={disabled}
        maxLength={TEXT_RESPONSE_MAX}
        name={entry.id}
        onBlur={() => save.flush()}
        onChange={(event) => write(event.currentTarget.value)}
        placeholder={t("short-placeholder")}
        ref={line}
        spellCheck={false}
      />
      <InputGroupAddon align="inline-end">
        <SittingKeypad field={line} keys="letters" />
      </InputGroupAddon>
    </InputGroup>
  );
}

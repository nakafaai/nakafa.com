import { TEXT_RESPONSE_MAX } from "@repo/backend/confect/assessment/response";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@repo/design-system/components/ui/input-group";
import { useTranslations } from "use-intl";
import {
  SittingEssay,
  SittingEssayEditor,
  SittingEssayWords,
} from "@/components/exams/sitting/essay";
import { SittingKeypad } from "@/components/exams/sitting/keypad";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import { useSittingTyping } from "@/components/exams/sitting/typing";
import type { Typed } from "@/components/player/response";

/**
 * The answer field of a short answer, a numeric answer, a formula or an essay: one line the student types a short
 * answer on, one line for a number with its unit beside it, one line for a formula written as LaTeX, or an essay,
 * written with its formulas in the answer editor (`SittingEssay`), as a paper exam leaves room to write. The field
 * saves as the student types (`useSittingTyping`). The Arabic keypad beside a word or a number types an Arabic
 * answer with its harakat, and the field follows the direction of the words the student writes. A line never
 * corrects, capitalizes or marks the spelling of what the student types, because the answer is read as it was
 * typed.
 */
export function SittingField({
  entry,
  labelledBy,
  onKeep,
  onType,
  saved,
  text,
}: {
  readonly entry: Typed;
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
  const t = useTranslations("Player");
  const { flush, line, write } = useSittingTyping({ onKeep, onType, saved });

  if (entry.kind === "extendedText") {
    return (
      <SittingEssay fallback={<SittingEssayWords text={text} />}>
        <SittingEssayEditor
          labelledBy={labelledBy}
          onBlur={flush}
          onChange={write}
          saved={saved}
          text={text}
        />
      </SittingEssay>
    );
  }

  if (entry.kind === "mathEntry") {
    // A formula reads left to right whatever language the question is in.
    return (
      <InputGroup data-disabled={disabled}>
        <InputGroupInput
          aria-labelledby={labelledBy}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          defaultValue={text}
          dir="ltr"
          disabled={disabled}
          maxLength={TEXT_RESPONSE_MAX}
          name={entry.id}
          onBlur={flush}
          onChange={(event) => write(event.currentTarget.value)}
          placeholder={t("placeholder.math")}
          ref={line}
          spellCheck={false}
        />
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
          onBlur={flush}
          onChange={(event) => write(event.currentTarget.value)}
          placeholder={t("placeholder.number")}
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
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        defaultValue={text}
        dir="auto"
        disabled={disabled}
        maxLength={TEXT_RESPONSE_MAX}
        name={entry.id}
        onBlur={flush}
        onChange={(event) => write(event.currentTarget.value)}
        placeholder={t("placeholder.short")}
        ref={line}
        spellCheck={false}
      />
      <InputGroupAddon align="inline-end">
        <SittingKeypad field={line} keys="letters" />
      </InputGroupAddon>
    </InputGroup>
  );
}

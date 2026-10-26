import { useDebouncedCallback } from "@mantine/hooks";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { TEXT_RESPONSE_MAX } from "@repo/backend/confect/exams/sittings/response";
import { Input } from "@repo/design-system/components/ui/input";
import { useState } from "react";
import { useTranslations } from "use-intl";

/** How long the student pauses typing before the answer is saved. */
const TYPING_PAUSE_MILLISECONDS = 800;

/** The longest the answer waits while the student keeps typing, so a long answer is saved as it grows. */
const TYPING_WAIT_MILLISECONDS = 4000;

/**
 * The answer line of a short answer: one field the student types the answer into, as a paper exam
 * leaves a line to write on. The field shows each key at once and saves the text once the student
 * pauses, leaves the field, or leaves the question, so a typed answer is not one save per key.
 */
export function SittingField({
  disabled = false,
  entry,
  labelledBy,
  onType,
  text,
}: {
  readonly disabled?: boolean;
  readonly entry: Extract<Interaction, { readonly kind: "textEntry" }>;
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  readonly onType: (text: string) => void;
  /** The text the paper holds for the question when the field opens. */
  readonly text: string;
}) {
  const t = useTranslations("Exams");
  const [typed, setTyped] = useState(text);
  const save = useDebouncedCallback(onType, {
    delay: TYPING_PAUSE_MILLISECONDS,
    flushOnUnmount: true,
    maxWait: TYPING_WAIT_MILLISECONDS,
  });

  return (
    <Input
      aria-labelledby={labelledBy}
      autoComplete="off"
      disabled={disabled}
      maxLength={TEXT_RESPONSE_MAX}
      name={entry.id}
      onBlur={() => save.flush()}
      onChange={(event) => {
        setTyped(event.currentTarget.value);
        save(event.currentTarget.value);
      }}
      placeholder={t("short-placeholder")}
      spellCheck={false}
      value={typed}
    />
  );
}

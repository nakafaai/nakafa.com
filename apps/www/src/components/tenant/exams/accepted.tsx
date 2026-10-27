import { BadgePlusIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  FieldDescription,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";

/** The most answers one short answer accepts, which keeps the key a short list a teacher reads at a glance. */
const ACCEPTED_MAX = 10;

/** The most characters of one accepted answer, as long as the line a student types. */
const ACCEPTED_LENGTH_MAX = 500;

/** Puts the cursor in a field as it mounts, as a new answer's field opens ready to type in. */
const focusOnMount = (node: HTMLInputElement | null) => node?.focus();

/** The props of one accepted answer's field. */
interface AcceptedRowProps {
  /** Whether the teacher may change the answer now. */
  readonly editable: boolean;
  /** The name of the field for assistive technology. */
  readonly label: string;
  /** Saves the text the teacher wrote, which replaces the answer; blank text takes the answer out. */
  readonly onCommit: (text: string) => void;
  /** Runs when the teacher leaves the field without changing it, which closes a new answer's empty field. */
  readonly onKeep?: () => void;
  /** Takes the answer out of the key, or none for a field that holds no answer yet. */
  readonly onRemove: (() => void) | null;
  /** The name of the remove action for assistive technology. */
  readonly removeLabel: string;
  /** The answer the key holds, which the field shows until the teacher types. */
  readonly text: string;
}

/**
 * One accepted answer: a field that saves when the teacher leaves it or presses Enter, and an action
 * that takes the answer out. A text the teacher did not change saves nothing.
 */
function AcceptedRow({
  editable,
  label,
  onCommit,
  onKeep,
  onRemove,
  removeLabel,
  text,
}: AcceptedRowProps) {
  const t = useTranslations("Exams");
  // The text the teacher types, which stands for the saved answer until the field is left.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = draft ?? text;
    setDraft(null);
    if (next === text) {
      onKeep?.();
      return;
    }
    onCommit(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={label}
        disabled={!editable}
        maxLength={ACCEPTED_LENGTH_MAX}
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder={t("answer-placeholder")}
        ref={onRemove === null ? focusOnMount : undefined}
        value={draft ?? text}
      />
      {onRemove === null ? null : (
        <Button
          aria-label={removeLabel}
          disabled={!editable}
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
        </Button>
      )}
    </div>
  );
}

/** The props of the accepted answers of one short answer. */
interface AcceptedAnswersProps {
  /** The answers the key accepts, in the order the teacher wrote them. */
  readonly accepted: readonly string[];
  /** Whether the teacher may change the answers now. */
  readonly editable: boolean;
  /** The number of the question, which names each field for assistive technology. */
  readonly number: number;
  /** Saves the answers the key accepts, which replace the ones it held. */
  readonly onChange: (accepted: readonly string[]) => void;
}

/**
 * The key of a short answer, as Google Forms lists the correct answers of a short answer question: one
 * field for each accepted answer, and an action that adds a field. A student's answer that matches one
 * of them after case and extra spaces is correct at once, and any other waits for the teacher to mark.
 */
export function AcceptedAnswers({
  accepted,
  editable,
  number,
  onChange,
}: AcceptedAnswersProps) {
  const t = useTranslations("Exams");
  // Whether a new, empty field is open below the answers, which saves once the teacher writes in it.
  const [adding, setAdding] = useState(false);
  const canAdd = editable && !adding && accepted.length < ACCEPTED_MAX;

  return (
    <div className="grid gap-2">
      <FieldTitle>{t("accepted-answers")}</FieldTitle>
      {Arr.map(accepted, (text, index) => (
        <AcceptedRow
          editable={editable}
          // The key keeps its accepted answers distinct (`acceptedKey`), so each text names one row.
          key={text}
          label={t("accepted-of", { index: index + 1, number })}
          onCommit={(next) =>
            onChange(
              Arr.map(accepted, (current, at) =>
                at === index ? next : current
              )
            )
          }
          onRemove={() => onChange(Arr.remove(accepted, index))}
          removeLabel={t("accepted-remove-of", { index: index + 1, number })}
          text={text}
        />
      ))}
      {adding ? (
        <AcceptedRow
          editable={editable}
          label={t("accepted-of", { index: accepted.length + 1, number })}
          onCommit={(next) => {
            setAdding(false);
            onChange(Arr.append(accepted, next));
          }}
          onKeep={() => setAdding(false)}
          onRemove={null}
          removeLabel=""
          text=""
        />
      ) : null}
      {canAdd ? (
        <div>
          <Button
            onClick={() => setAdding(true)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={BadgePlusIcon} />
            {t("accepted-add")}
          </Button>
        </div>
      ) : null}
      <FieldDescription>{t("accepted-hint")}</FieldDescription>
    </div>
  );
}

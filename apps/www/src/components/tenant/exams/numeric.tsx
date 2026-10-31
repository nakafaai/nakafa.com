import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Schema } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  type NumberSetting,
  ToleranceKind,
  withNumber,
} from "@/components/tenant/exams/number";

/** The most characters a number or a unit takes in the teacher's layer, as long as a number is written. */
const NUMBER_LENGTH_MAX = 40;

/** Whether a value the select gives is one of the tolerances. */
const isToleranceKind = Schema.is(ToleranceKind);

/** The name of each tolerance in the Exams messages. */
const TOLERANCE_NAME = {
  absolute: "number-tolerance-absolute",
  exact: "number-tolerance-exact",
  relative: "number-tolerance-relative",
} as const satisfies Record<ToleranceKind, string>;

/**
 * One text of the numeric key that saves when the teacher leaves it or presses Enter. `onCommit` says whether
 * the text was saved: a text it refuses stays in the field, with `refusal` under it, until the teacher writes one
 * it takes, so the number the key holds is never lost to a slip. A text the teacher did not change saves nothing.
 */
function CommitText({
  disabled,
  id,
  inputMode,
  label,
  onCommit,
  placeholder,
  refusal,
  text,
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly inputMode: "decimal" | "text";
  /** The field's name for assistive technology, when no label of the form names it. */
  readonly label?: string;
  readonly onCommit: (text: string) => boolean;
  /** An example of what the field takes, which shows while it is empty. */
  readonly placeholder: string;
  readonly refusal: string;
  readonly text: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);

  const commit = () => {
    if (draft === null || draft === text) {
      setDraft(null);
      setRefused(false);
      return;
    }
    const saved = onCommit(draft);
    setRefused(!saved);
    if (saved) {
      setDraft(null);
    }
  };

  return (
    <>
      <Input
        aria-invalid={refused}
        aria-label={label}
        disabled={disabled}
        id={id}
        inputMode={inputMode}
        maxLength={NUMBER_LENGTH_MAX}
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        value={draft ?? text}
      />
      {refused ? <FieldError>{refusal}</FieldError> : null}
    </>
  );
}

/**
 * The key of a numeric answer, as a calculator question's settings read: the correct number, how far a
 * student's number may stray from it, whether a fraction counts, and the unit shown beside the student's
 * field. A number or a tolerance is saved only when the contract grades it (`withNumber`); any other is kept
 * in its field with the reason, and a blank number clears the key. The tolerance waits for the number, and a
 * tolerance chosen with no distance yet keeps the key exact until its distance is written.
 */
export function NumberKey({
  answers,
  editable,
  number,
  onChange,
  setting,
}: {
  readonly answers: Arr.NonEmptyReadonlyArray<Interaction>;
  readonly editable: boolean;
  /** The number of the question, which names each field for assistive technology. */
  readonly number: number;
  readonly onChange: (setting: NumberSetting) => void;
  readonly setting: NumberSetting;
}) {
  const t = useTranslations("Exams");
  const id = useId();
  // A tolerance the teacher chose whose distance is not written yet, which the key takes once it is.
  const [chosen, setChosen] = useState<ToleranceKind | null>(null);
  const kind = chosen ?? setting.toleranceKind;

  /** Saves a setting the contract grades, or a blank number, which clears the key, and says whether it saved. */
  const save = (next: NumberSetting) => {
    if (next.value !== "" && withNumber(answers, next).key === null) {
      return false;
    }
    onChange(next);
    return true;
  };

  return (
    <Field>
      <FieldTitle>{t("number-key")}</FieldTitle>
      <Field>
        <FieldLabel htmlFor={`${id}-value`}>
          {t("number-value-of", { number })}
        </FieldLabel>
        <CommitText
          disabled={!editable}
          id={`${id}-value`}
          inputMode="decimal"
          onCommit={(value) => save({ ...setting, value })}
          placeholder={t("number-value-placeholder")}
          refusal={t("number-refused")}
          text={setting.value}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-tolerance`}>
          {t("number-tolerance-of", { number })}
        </FieldLabel>
        <Select
          items={Arr.map(ToleranceKind.literals, (value) => ({
            label: t(TOLERANCE_NAME[value]),
            value,
          }))}
          onValueChange={(value) => {
            if (!isToleranceKind(value)) {
              return;
            }
            if (value !== "exact") {
              setChosen(value);
              return;
            }
            setChosen(null);
            save({ ...setting, tolerance: "", toleranceKind: "exact" });
          }}
          value={kind}
        >
          <SelectTrigger
            className="w-full"
            disabled={!editable || setting.value === ""}
            id={`${id}-tolerance`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Arr.map(ToleranceKind.literals, (value) => (
              <SelectItem key={value} value={value}>
                {t(TOLERANCE_NAME[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {kind === "exact" ? null : (
          <CommitText
            disabled={!editable}
            id={`${id}-within`}
            inputMode="decimal"
            label={t("number-within-of", { number })}
            onCommit={(tolerance) => {
              const saved = save({
                ...setting,
                tolerance,
                toleranceKind: kind,
              });
              if (saved) {
                setChosen(null);
              }
              return saved;
            }}
            placeholder={t("number-tolerance-placeholder")}
            refusal={t(
              kind === "relative"
                ? "number-tolerance-relative-refused"
                : "number-refused"
            )}
            text={setting.toleranceKind === kind ? setting.tolerance : ""}
          />
        )}
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          checked={setting.acceptsFractions}
          disabled={!editable}
          id={`${id}-fractions`}
          onCheckedChange={(acceptsFractions) =>
            save({ ...setting, acceptsFractions })
          }
        />
        <FieldLabel htmlFor={`${id}-fractions`}>
          {t("number-fractions")}
        </FieldLabel>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-unit`}>{t("number-unit")}</FieldLabel>
        <CommitText
          disabled={!editable}
          id={`${id}-unit`}
          inputMode="text"
          onCommit={(unit) => save({ ...setting, unit })}
          placeholder={t("number-unit-placeholder")}
          refusal=""
          text={setting.unit}
        />
      </Field>
      <FieldDescription>{t("number-hint")}</FieldDescription>
    </Field>
  );
}

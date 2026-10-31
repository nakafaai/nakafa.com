import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { ScoringKind } from "@repo/backend/confect/exams/scoring";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Function as Fn, Schema } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  type Question,
  scoringUpdate,
} from "@/components/tenant/exams/optimistic";
import { useExam } from "@/components/tenant/exams/provider";

/** Whether a value the select gives is one of the rules. */
const isScoringKind = Schema.is(ScoringKind);

/** The dictionary key that names each rule. */
const SCORING_NAME = {
  allOrNothing: "scoring-whole",
  perPart: "scoring-parts",
  wrongParts: "scoring-bands",
} as const satisfies Record<ScoringKind, string>;

/** The dictionary key that says what each rule gives. */
const SCORING_HINT = {
  allOrNothing: "scoring-whole-hint",
  perPart: "scoring-parts-hint",
  wrongParts: "scoring-bands-hint",
} as const satisfies Record<ScoringKind, string>;

/**
 * The rule that shares a question's points among the parts of an answer: all or nothing, per part, or the
 * AKM's bands. The choice shows at once, with the points it raises, and rolls back when the server refuses it.
 */
export function ScoringField({
  editable,
  kind,
  questionId,
}: {
  /** Whether the teacher may change the rule now. */
  readonly editable: boolean;
  /** The rule the server holds, which the field shows. */
  readonly kind: ScoringKind;
  /** The question whose rule the field sets. */
  readonly questionId: Question["id"];
}) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const id = useId();
  const save = useMutation(exams.questions.scoring).withOptimisticUpdate(
    scoringUpdate
  );

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("scoring")}</FieldLabel>
      <Select
        items={Arr.map(ScoringKind.literals, (value) => ({
          label: t(SCORING_NAME[value]),
          value,
        }))}
        onValueChange={(value) => {
          if (!isScoringKind(value) || value === kind) {
            return;
          }
          runExamAction(
            sentAction(() =>
              save({ examId: exam.id, questionId, scoring: value, slug })
            ),
            { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
          );
        }}
        value={kind}
      >
        <SelectTrigger className="w-full" disabled={!editable} id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Arr.map(ScoringKind.literals, (value) => (
            <SelectItem key={value} value={value}>
              {t(SCORING_NAME[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{t(SCORING_HINT[kind])}</FieldDescription>
    </Field>
  );
}

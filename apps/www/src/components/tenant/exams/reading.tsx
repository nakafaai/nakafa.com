import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
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
import { Array as Arr, Function as Fn, Option, pipe } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  type Question,
  readingUpdate,
  sharedReadings,
} from "@/components/tenant/exams/optimistic";
import { useExam } from "@/components/tenant/exams/provider";

/** The reading a new choice of the field asks for, by its value. */
const NO_READING = "none";

/** The value of the field's choice of a new reading, which also stands for the question's own. */
const NEW_READING = "new";

/**
 * The shared reading of a question: none, a new one the teacher writes on the paper, or the reading of another
 * question, so several questions are asked of one text. Taking none away or sharing shows at once, and rolls back
 * when the server refuses it. A new reading waits for the server, which makes its document.
 */
export function ReadingField({
  editable,
  question,
}: {
  /** Whether the teacher may change the reading now. */
  readonly editable: boolean;
  /** The question as the server holds it. */
  readonly question: Question;
}) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const id = useId();
  const save = useMutation(exams.questions.reading).withOptimisticUpdate(
    readingUpdate
  );
  const shared = sharedReadings(exam.questions, question.id);
  const items = [
    { label: t("reading-none"), value: NO_READING },
    { label: t("reading-new"), value: NEW_READING },
    ...Arr.map(shared, ({ number, source }) => ({
      label: t("reading-same", { number }),
      value: source,
    })),
  ];
  const held = pipe(
    Arr.findFirst(shared, ({ reading }) => reading === question.reading),
    Option.match({
      onNone: () => (question.reading === null ? NO_READING : NEW_READING),
      onSome: ({ source }) => source,
    })
  );

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("reading")}</FieldLabel>
      <Select
        items={items}
        onValueChange={(value) => {
          const source =
            value === NO_READING || value === NEW_READING
              ? Option.some(value)
              : Option.map(
                  Arr.findFirst(shared, (peer) => peer.source === value),
                  (peer) => peer.source
                );
          if (Option.isNone(source) || value === held) {
            return;
          }
          runExamAction(
            sentAction(() =>
              save({
                examId: exam.id,
                questionId: question.id,
                slug,
                source: source.value,
              })
            ),
            { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
          );
        }}
        value={held}
      >
        <SelectTrigger className="w-full" disabled={!editable} id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Arr.map(items, (item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{t("reading-hint")}</FieldDescription>
    </Field>
  );
}

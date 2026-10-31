import { LatePolicy } from "@repo/backend/confect/classroom/tasks/task";
import { DateTimePicker } from "@repo/design-system/components/ui/date";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, Option, Schema } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import type { TaskDraft } from "@/components/tenant/classes/tasks/draft";

/**
 * The fields of a task's form, the same when a teacher publishes a task and when they edit it: its title, what it
 * asks, its deadline in the browser's own time, its points, and what late work gets. Each change hands the whole
 * form back. Points that are fixed, once work is handed in, show disabled with the sentence that says why.
 */
export function TaskFields({
  draft,
  onChange,
  pointsFixed,
}: {
  draft: typeof TaskDraft.Type;
  onChange: (draft: typeof TaskDraft.Type) => void;
  pointsFixed: boolean;
}) {
  const t = useTranslations("Classroom");
  const id = useId();
  const policies = Arr.map(LatePolicy.literals, (policy) => ({
    label: t(`task-late-${policy}`),
    value: policy,
  }));

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>{t("task-title")}</FieldLabel>
        <Input
          dir="auto"
          id={`${id}-title`}
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value })
          }
          placeholder={t("task-title-placeholder")}
          value={draft.title}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-text`}>{t("task-text")}</FieldLabel>
        <Textarea
          className="min-h-28"
          dir="auto"
          id={`${id}-text`}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
          placeholder={t("task-text-placeholder")}
          value={draft.text}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-deadline`}>{t("task-deadline")}</FieldLabel>
        <DateTimePicker
          dayPlaceholder={t("task-day-placeholder")}
          id={`${id}-deadline`}
          onValueChange={(deadline) => onChange({ ...draft, deadline })}
          timePlaceholder={t("task-time-placeholder")}
          value={draft.deadline}
        />
      </Field>
      <div className="grid gap-7 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-points`}>{t("task-points")}</FieldLabel>
          <NumberField
            disabled={pointsFixed}
            id={`${id}-points`}
            max={1000}
            min={0}
            onValueChange={(points) => onChange({ ...draft, points })}
            value={draft.points}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldGroup>
          </NumberField>
          {pointsFixed ? (
            <FieldDescription>{t("task-points-fixed")}</FieldDescription>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-late`}>{t("task-late")}</FieldLabel>
          <Select
            items={policies}
            onValueChange={(value) =>
              Option.map(
                Schema.decodeUnknownOption(LatePolicy)(value),
                (latePolicy) => onChange({ ...draft, latePolicy })
              )
            }
            value={draft.latePolicy}
          >
            <SelectTrigger className="w-full" id={`${id}-late`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(policies, (policy) => (
                <SelectItem key={policy.value} value={policy.value}>
                  {policy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FieldGroup>
  );
}

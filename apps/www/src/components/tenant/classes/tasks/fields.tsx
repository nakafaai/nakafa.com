import { QueryResult, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { LatePolicy } from "@repo/backend/confect/classroom/tasks/task";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
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
import { useClassScope } from "@/components/tenant/classes/scope";
import type { TaskDraft } from "@/components/tenant/classes/tasks/draft";

/** Who a task can go to. */
const REACHES = ["class", "some"] as const;

/**
 * The fields of a task's form, the same when a teacher publishes a task and when they edit it: its title, what it
 * asks, its deadline in the browser's own time, its points, what late work gets, and who it goes to. Each change hands the whole
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
      <TaskReachField draft={draft} onChange={onChange} />
    </FieldGroup>
  );
}

/** Who a task goes to: the whole class, or the students the teacher ticks, read once the teacher asks for them. */
function TaskReachField({
  draft,
  onChange,
}: {
  draft: typeof TaskDraft.Type;
  onChange: (draft: typeof TaskDraft.Type) => void;
}) {
  const t = useTranslations("Classroom");
  const id = useId();
  const { classId, slug } = useClassScope();
  const people = useQuery(
    classroom.people.list,
    draft.targets === null ? "skip" : { classId, slug }
  );
  const students = QueryResult.isSuccess(people)
    ? Arr.filter(people.value, (person) => person.kind === "student")
    : [];
  const reaches = Arr.map(REACHES, (value) => ({
    label: t(`task-reach-${value}`),
    value,
  }));
  const chosen = draft.targets ?? [];

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-reach`}>{t("task-reach")}</FieldLabel>
        <Select
          items={reaches}
          onValueChange={(value) =>
            onChange({ ...draft, targets: value === "some" ? [] : null })
          }
          value={draft.targets === null ? "class" : "some"}
        >
          <SelectTrigger className="w-full" id={`${id}-reach`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Arr.map(reaches, (reach) => (
              <SelectItem key={reach.value} value={reach.value}>
                {reach.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {draft.targets === null ? null : (
        <FieldGroup className="max-h-48 gap-3 overflow-y-auto rounded-md border p-3">
          {Arr.map(students, (student) => (
            <Field key={student.id} orientation="horizontal">
              <Checkbox
                checked={Arr.contains(chosen, student.id)}
                id={`${id}-${student.id}`}
                onCheckedChange={(next) =>
                  onChange({
                    ...draft,
                    targets: next
                      ? Arr.append(chosen, student.id)
                      : Arr.filter(chosen, (found) => found !== student.id),
                  })
                }
              />
              <FieldLabel dir="auto" htmlFor={`${id}-${student.id}`}>
                {student.name}
              </FieldLabel>
            </Field>
          ))}
        </FieldGroup>
      )}
    </>
  );
}

import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  LatePolicy,
  TaskPoints,
  TaskText,
  TaskTitle,
} from "@repo/backend/confect/classroom/tasks/task";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Number as Num, Option, Schema, String as Str } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { useClassScope } from "@/components/tenant/classes/scope";
import { deadlineOf } from "@/components/tenant/classes/tasks/deadline";

/**
 * Publishes a task to the class: its title, what it asks, its deadline in the browser's own time,
 * its points, and what late work gets. The dialog closes on submit and the task joins the list once
 * the server holds it under its address; a refusal brings the dialog back with what was written.
 */
export function NewTask() {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const publish = useMutation(classroom.tasks.publish);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [points, setPoints] = useState("100");
  const [latePolicy, setLatePolicy] = useState<typeof LatePolicy.Type>("accept");
  const id = useId();
  const policies = Arr.map(LatePolicy.literals, (policy) => ({
    label: t(`task-late-${policy}`),
    value: policy,
  }));
  const heading = Str.trim(title);
  const body = Str.trim(text);
  const due = deadlineOf(deadline);
  const worth = Option.filter(Num.parse(points), Schema.is(TaskPoints));
  const ready =
    Schema.is(TaskTitle)(heading) &&
    Schema.is(TaskText)(body) &&
    Option.isSome(due) &&
    Option.isSome(worth);

  const submit = () => {
    if (!(ready && Option.isSome(due) && Option.isSome(worth))) {
      return;
    }
    setOpen(false);
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        forumCall(() =>
          publish({
            classId,
            clientKey,
            deadline: due.value,
            latePolicy,
            points: worth.value,
            slug,
            text: body,
            title: heading,
          })
        )
      ).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            setTitle("");
            setText("");
            setDeadline("");
          })
        )
      ),
      () => {
        setOpen(true);
        toastForumFailure();
      }
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("task-new")}</Button>
      <ResponsiveDialog
        description={t("task-new-description")}
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button disabled={!ready} onClick={submit}>
              {t("task-publish")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("task-new")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>{t("task-title")}</FieldLabel>
            <Input
              dir="auto"
              id={`${id}-title`}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-text`}>{t("task-text")}</FieldLabel>
            <Textarea
              className="min-h-28"
              dir="auto"
              id={`${id}-text`}
              onChange={(event) => setText(event.target.value)}
              value={text}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-deadline`}>
              {t("task-deadline")}
            </FieldLabel>
            <Input
              id={`${id}-deadline`}
              onChange={(event) => setDeadline(event.target.value)}
              type="datetime-local"
              value={deadline}
            />
          </Field>
          <div className="grid gap-7 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${id}-points`}>
                {t("task-points")}
              </FieldLabel>
              <Input
                id={`${id}-points`}
                inputMode="numeric"
                max={1000}
                min={0}
                onChange={(event) => setPoints(event.target.value)}
                type="number"
                value={points}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-late`}>{t("task-late")}</FieldLabel>
              <Select
                items={policies}
                onValueChange={(value) =>
                  Option.map(
                    Schema.decodeUnknownOption(LatePolicy)(value),
                    setLatePolicy
                  )
                }
                value={latePolicy}
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
      </ResponsiveDialog>
    </>
  );
}

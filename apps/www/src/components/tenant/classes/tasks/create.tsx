import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { PencilEdit02Icon, TaskEdit01Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Option } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DialogRefusal } from "@/components/shared/refusal";
import {
  forumCall,
  runForumCall,
} from "@/components/tenant/classes/forum/call";
import { classRefusalCopy } from "@/components/tenant/classes/refusals";
import { useClassScope } from "@/components/tenant/classes/scope";
import {
  checkedDraft,
  EMPTY_DRAFT,
} from "@/components/tenant/classes/tasks/draft";
import { TaskFields } from "@/components/tenant/classes/tasks/fields";
import {
  examOfChoice,
  WRITTEN,
} from "@/components/tenant/classes/tasks/questions";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { useClockZone } from "@/components/tenant/settings/time";

/** How many of the school's exams the picker offers. */
const EXAM_PAGE_SIZE = 50;

/**
 * Publishes a task to the class: its title, what it asks, its deadline in the browser's own time,
 * its points, what late work gets, and its questions: a written answer, or an exam the teacher built
 * in the exam editor, which the class then does in the exam player. The dialog closes on submit and
 * the task joins the list once the server holds it under its address; a refusal brings the dialog
 * back with what was written and says why inside it.
 */
export function NewTask() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const publish = useMutation(classroom.tasks.publish);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [exam, setExam] = useState(WRITTEN);
  const [refusal, setRefusal] = useState<ToastCopy | null>(null);
  const checked = checkedDraft(draft, useClockZone());

  const submit = () => {
    if (Option.isNone(checked)) {
      return;
    }
    setOpen(false);
    setRefusal(null);
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        forumCall(() =>
          publish({
            ...checked.value,
            classId,
            clientKey,
            examId: examOfChoice(exam),
            slug,
          })
        )
      ).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            setDraft(EMPTY_DRAFT);
            setExam(WRITTEN);
          })
        )
      ),
      (error) => {
        setRefusal(classRefusalCopy(error));
        setOpen(true);
      }
    );
  };

  return (
    <>
      <SchoolHeaderAdd label={t("task-new")} onClick={() => setOpen(true)} />
      <ResponsiveDialog
        action={
          <Button disabled={Option.isNone(checked)} onClick={submit}>
            {t("task-publish")}
          </Button>
        }
        description={t("task-new-description")}
        open={open}
        setOpen={setOpen}
        title={t("task-new")}
      >
        {refusal === null ? null : <DialogRefusal copy={refusal} />}
        <TaskFields draft={draft} onChange={setDraft} pointsFixed={false} />
        <TaskExamField exam={exam} onExam={setExam} />
      </ResponsiveDialog>
    </>
  );
}

/**
 * The task's questions: a written answer, or one of the school's exams that the teacher may edit and
 * that holds questions, built in the exam editor. The exams load once the session settles.
 */
function TaskExamField({
  exam,
  onExam,
}: {
  exam: string;
  onExam: (exam: string) => void;
}) {
  const common = useTranslations("Common");
  const t = useTranslations("Classroom");
  const { slug } = useClassScope();
  const id = useId();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    exams.exams.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: EXAM_PAGE_SIZE }
  );
  const offered = PaginatedQueryResult.isFailure(pagination)
    ? []
    : Arr.filter(
        pagination.results,
        (listed) => listed.canEdit && listed.questionCount > 0
      );
  const items = [
    { label: t("task-exam-none"), value: WRITTEN },
    ...Arr.map(offered, (listed) => ({
      label: listed.title,
      value: listed.id,
    })),
  ];

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-exam`}>{t("task-exam")}</FieldLabel>
      <Select
        items={items}
        onValueChange={(value) => onExam(String(value ?? WRITTEN))}
        value={exam}
      >
        <SelectTrigger className="w-full" id={`${id}-exam`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent label={common("menu-question")}>
          {Arr.map(items, (item) => (
            <SelectItem
              icon={item.value === WRITTEN ? PencilEdit02Icon : TaskEdit01Icon}
              key={item.value}
              value={item.value}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{t("task-exam-description")}</FieldDescription>
    </Field>
  );
}

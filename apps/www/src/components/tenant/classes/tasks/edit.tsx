import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { DialogRefusal } from "@/components/shared/refusal";
import { useClassScope } from "@/components/tenant/classes/scope";
import {
  checkedDraft,
  draftOf,
  type TaskDraft,
} from "@/components/tenant/classes/tasks/draft";
import { TaskFields } from "@/components/tenant/classes/tasks/fields";
import {
  type ClassTask,
  editUpdate,
} from "@/components/tenant/classes/tasks/optimistic";
import { useClockZone } from "@/components/tenant/settings/time";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/**
 * The dialog that edits a task: the same fields as its publish, filled in with the task. Save waits for a change
 * the server accepts, the task shows the change at once, and a refusal brings the dialog back with what was written and says why inside it.
 * Its points are fixed once work is handed in.
 */
export function EditTaskDialog({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const tCommon = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const edit = useMutation(classroom.tasks.edit).withOptimisticUpdate(
    editUpdate
  );
  const [open, setOpen] = useState(true);
  const [refusal, setRefusal] = useState<ToastCopy | null>(null);
  // The form holds only what the teacher changed, and shows the task as it stands until then.
  const [edited, setDraft] = useState<typeof TaskDraft.Type | null>(null);
  const timeZone = useClockZone();
  const draft = edited ?? draftOf(task, timeZone);
  const checked = checkedDraft(draft, timeZone);
  const changed = Option.exists(
    checked,
    (next) =>
      next.category !== task.category ||
      next.title !== task.title ||
      next.text !== task.text ||
      next.deadline !== task.deadline ||
      next.points !== task.points ||
      next.latePolicy !== task.latePolicy ||
      next.targets !== task.targets
  );

  const save = () => {
    if (Option.isNone(checked)) {
      return;
    }
    setOpen(false);
    setRefusal(null);
    runSchoolWrite(
      schoolCall(() =>
        edit({ ...checked.value, classId, slug, task: task.slug })
      ),
      {
        onRefused: (copy) => {
          setRefusal(copy);
          setOpen(true);
        },
      }
    );
  };

  return (
    <ResponsiveDialog
      action={
        <Button disabled={!changed} onClick={save}>
          {tCommon("save")}
        </Button>
      }
      description={t("task-edit-description")}
      open={open}
      setOpen={setOpen}
      title={t("task-edit")}
    >
      {refusal === null ? null : <DialogRefusal copy={refusal} />}
      <TaskFields
        draft={draft}
        onChange={setDraft}
        pointsFixed={task.handedIn > 0}
      />
    </ResponsiveDialog>
  );
}

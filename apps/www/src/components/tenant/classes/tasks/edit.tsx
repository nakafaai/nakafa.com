import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
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

/**
 * The dialog that edits a task: the same fields as its publish, filled in with the task. Save waits for a change
 * the server accepts, the task shows the change at once, and a refusal brings the dialog back with what was written.
 * Its points are fixed once work is handed in.
 */
export function EditTaskDialog({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const edit = useMutation(classroom.tasks.edit).withOptimisticUpdate(
    editUpdate
  );
  const [open, setOpen] = useState(true);
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
    runForumCall(
      forumCall(() =>
        edit({ ...checked.value, classId, slug, task: task.slug })
      ),
      () => {
        setOpen(true);
        toastForumFailure();
      }
    );
  };

  return (
    <ResponsiveDialog
      description={t("task-edit-description")}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button disabled={!changed} onClick={save}>
            {t("task-edit-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("task-edit")}
    >
      <TaskFields
        draft={draft}
        onChange={setDraft}
        pointsFixed={task.handedIn > 0}
      />
    </ResponsiveDialog>
  );
}

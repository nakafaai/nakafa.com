import { QueryResult, useMutation, useQuery } from "@confect/react";
import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
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
 * The header's Edit task on a task's page, for its teacher. It stands from the first paint and waits disabled
 * until the task is read. Each opening is a dialog of its own, filled in with the task as it stands then.
 */
export function EditTask({ task: address }: { task: string }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const read = useQuery(
    classroom.tasks.get,
    isSettled ? { classId, slug, task: address } : "skip"
  );
  const [openings, setOpenings] = useState(0);
  const task = QueryResult.isSuccess(read)
    ? Option.some(read.value)
    : Option.none();

  return (
    <>
      <Button
        aria-label={t("task-edit")}
        disabled={Option.isNone(task)}
        onClick={() => setOpenings((count) => count + 1)}
        variant="outline"
      >
        <HugeIcons aria-hidden="true" icon={PencilEdit02Icon} />
        <span className="max-sm:sr-only">{t("task-edit")}</span>
      </Button>
      {openings === 0 || Option.isNone(task) ? null : (
        <EditTaskDialog key={openings} task={task.value} />
      )}
    </>
  );
}

/**
 * The dialog that edits a task: the same fields as its publish, filled in with the task. Save waits for a change
 * the server accepts, the task shows the change at once, and a refusal brings the dialog back with what was written.
 * Its points are fixed once work is handed in.
 */
function EditTaskDialog({ task }: { task: ClassTask }) {
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

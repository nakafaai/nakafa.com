import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  Delete02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { usePanes } from "@/components/shared/panes";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { RowItems, RowOpen } from "@/components/shared/table/menu";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { useClassScope } from "@/components/tenant/classes/scope";
import { EditTaskDialog } from "@/components/tenant/classes/tasks/edit";
import {
  archiveUpdate,
  type ClassTask,
  removeUpdate,
  restoreUpdate,
} from "@/components/tenant/classes/tasks/optimistic";

/**
 * What a row of the task table can do: open the task in the pane, and for a teacher who keeps the class's tasks, edit
 * it, archive it out of the class or restore it, and delete it, which asks first. Each change takes the row out of the
 * list it leaves at once and brings it back with the School toast on a refusal.
 */
export function TaskRowMenu({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const [openings, setOpenings] = useState(0);
  const remove = useMutation(classroom.tasks.remove);
  const archive = useMutation(classroom.tasks.archive);
  const restore = useMutation(classroom.tasks.restore);
  const open = usePanes((state) => state.open);
  const close = usePanes((state) => state.close);
  const args = { classId, slug, task: task.slug };

  if (!Arr.contains(can, "task.manage")) {
    return (
      <RowItems>
        <RowOpen icon={ArrowRight01Icon} label={t("task-open")} />
      </RowItems>
    );
  }

  /** Closes the pane of a task that leaves the list. */
  const leave = () => {
    if (Option.contains(open, task.slug)) {
      close();
    }
  };

  return (
    <>
      <ConfirmRowMenu
        action={t("task-remove")}
        confirm={t("task-remove")}
        description={t("task-remove-description")}
        icon={Delete02Icon}
        onConfirm={() => {
          leave();
          runForumCall(
            forumCall(() => remove.withOptimisticUpdate(removeUpdate)(args)),
            toastForumFailure
          );
        }}
        title={t("task-remove-title")}
      >
        <RowOpen icon={ArrowRight01Icon} label={t("task-open")} />
        <DropdownMenuItem onClick={() => setOpenings((count) => count + 1)}>
          <HugeIcons icon={PencilEdit02Icon} />
          {t("task-edit")}
        </DropdownMenuItem>
        {task.archived ? (
          <DropdownMenuItem
            onClick={() => {
              leave();
              runForumCall(
                forumCall(() =>
                  restore.withOptimisticUpdate(restoreUpdate)(args)
                ),
                toastForumFailure
              );
            }}
          >
            <HugeIcons icon={ArrowTurnBackwardIcon} />
            {t("task-restore")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => {
              leave();
              runForumCall(
                forumCall(() =>
                  archive.withOptimisticUpdate(archiveUpdate)(args)
                ),
                toastForumFailure
              );
            }}
          >
            <HugeIcons icon={Archive02Icon} />
            {t("task-archive")}
          </DropdownMenuItem>
        )}
      </ConfirmRowMenu>
      {openings === 0 ? null : <EditTaskDialog key={openings} task={task} />}
    </>
  );
}

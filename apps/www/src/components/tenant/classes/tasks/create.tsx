import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option } from "effect";
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
  EMPTY_DRAFT,
} from "@/components/tenant/classes/tasks/draft";
import { TaskFields } from "@/components/tenant/classes/tasks/fields";

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
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const checked = checkedDraft(draft);

  const submit = () => {
    if (Option.isNone(checked)) {
      return;
    }
    setOpen(false);
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        forumCall(() => publish({ ...checked.value, classId, clientKey, slug }))
      ).pipe(Effect.tap(() => Effect.sync(() => setDraft(EMPTY_DRAFT)))),
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
            <Button disabled={Option.isNone(checked)} onClick={submit}>
              {t("task-publish")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("task-new")}
      >
        <TaskFields draft={draft} onChange={setDraft} pointsFixed={false} />
      </ResponsiveDialog>
    </>
  );
}

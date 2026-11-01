import { QueryResult, useMutation, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TaskText } from "@repo/backend/confect/classroom/tasks/task";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Schema,
  String as Str,
} from "effect";
import { useId, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { reloadPage } from "@/components/shared/reload";
import { LoadFailure } from "@/components/state/failure";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { ClassMissingBody } from "@/components/tenant/classes/missing";
import { useClassScope } from "@/components/tenant/classes/scope";
import { TaskStanding } from "@/components/tenant/classes/tasks/list";
import { TaskMissingTable } from "@/components/tenant/classes/tasks/missing";
import {
  type ClassTask,
  submitUpdate,
} from "@/components/tenant/classes/tasks/optimistic";
import { TaskWorkTable } from "@/components/tenant/classes/tasks/work";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";

/**
 * One task of a class: what it asks and when it is due, worth how many points, and what late work
 * gets, then the student's own hand-in or, for its teacher, the work handed in and who has not. A reader who neither
 * teaches the class nor learns in it sees the task alone. A task the class does not hold shows the
 * missing state, a failed read its sentence and Try again.
 */
export function TaskPage({ task: address }: { task: string }) {
  const { can, classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const read = useQuery(
    classroom.tasks.get,
    isSettled ? { classId, slug, task: address } : "skip"
  );
  if (QueryResult.isFailure(read)) {
    if (isLostAccess(read.error)) {
      throw read.error;
    }
    return isDenied(read.error) ? (
      <ClassMissingBody />
    ) : (
      <LoadFailure onRetry={reloadPage} />
    );
  }
  if (!QueryResult.isSuccess(read)) {
    return null;
  }
  const task = read.value;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <TaskDetails task={task} />
      {Arr.contains(can, "task.manage") ? (
        <>
          <TaskWorkTable task={task} />
          <TaskMissingTable task={task} />
        </>
      ) : null}
      {Arr.contains(can, "task.submit") && !Arr.contains(can, "task.manage") ? (
        <HandIn key={task.id} task={task} />
      ) : null}
    </div>
  );
}

/** What a task asks, its deadline, its points, and what late work gets, one fact per line. */
function TaskDetails({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-lg font-semibold wrap-anywhere" dir="auto">
        {task.title}
      </h2>
      <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <dt className="text-muted-foreground">{t("task-deadline")}</dt>
        <dd>
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(task.deadline)),
            {
              dateStyle: "full",
              timeStyle: "short",
            }
          )}
        </dd>
        <dt className="text-muted-foreground">{t("task-points")}</dt>
        <dd>{task.points}</dd>
        <dt className="text-muted-foreground">{t("task-late")}</dt>
        <dd>{t(`task-late-${task.latePolicy}`)}</dd>
        {task.targets === null ? null : (
          <>
            <dt className="text-muted-foreground">{t("task-reach")}</dt>
            <dd>{t("task-reach-count", { count: task.targets.length })}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("task-status")}</dt>
        <dd>
          <TaskStanding task={task} />
        </dd>
      </dl>
      <p className="text-sm wrap-anywhere whitespace-pre-wrap" dir="auto">
        {task.text}
      </p>
    </section>
  );
}

/**
 * The student's hand-in: one field that holds the work they handed in, and Hand in, which waits disabled until the
 * field holds new work. The work shows as handed in at once and stays in the field, so the student reads and changes
 * it there, and the button keeps its words and its place. A task that closes at its deadline says so once that passes,
 * and takes no more work. A refusal the page could not foresee shows the toast every School action uses, and the field
 * keeps the text.
 */
function HandIn({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const submit = useMutation(classroom.tasks.submit);
  const [text, setText] = useState(task.mine?.text ?? "");
  const id = useId();
  const body = Str.trim(text);
  const isClosed =
    task.latePolicy === "close" &&
    task.deadline < DateTime.toEpochMillis(DateTime.nowUnsafe());
  const ready =
    !isClosed && Schema.is(TaskText)(body) && body !== task.mine?.text;

  const handIn = () => {
    if (!ready) {
      return;
    }
    runForumCall(
      Effect.flatMap(Clock.currentTimeMillis, (at) =>
        forumCall(() =>
          submit.withOptimisticUpdate(submitUpdate(at))({
            classId,
            slug,
            task: task.slug,
            text: body,
          })
        )
      ),
      toastForumFailure
    );
  };

  return (
    <form action={handIn} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor={`${id}-work`}>{t("task-work")}</FieldLabel>
        <Textarea
          className="min-h-40"
          dir="auto"
          id={`${id}-work`}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("handin-placeholder")}
          readOnly={isClosed}
          value={text}
        />
        {isClosed ? (
          <FieldDescription>{t("task-closed")}</FieldDescription>
        ) : null}
      </Field>
      <div className="flex justify-end">
        <Button disabled={!ready} type="submit">
          {t("task-hand-in")}
        </Button>
      </div>
    </form>
  );
}

import { QueryResult, useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TaskText } from "@repo/backend/confect/classroom/tasks/task";
import { Button } from "@repo/design-system/components/ui/button";
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
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { ClassMissingBody } from "@/components/tenant/classes/missing";
import { useClassScope } from "@/components/tenant/classes/scope";
import { TaskStanding } from "@/components/tenant/classes/tasks/list";
import {
  type ClassTask,
  submitUpdate,
} from "@/components/tenant/classes/tasks/optimistic";
import { TaskWorkTable } from "@/components/tenant/classes/tasks/work";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * One task of a class: what it asks and when it is due, worth how many points, and what late work
 * gets, then the student's own hand-in or, for its teacher, the work handed in. A task the class
 * does not hold shows the missing state, a failed read its sentence and Try again.
 */
export function TaskPage({ task: address }: { task: string }) {
  const { can, classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const read = usePreloadedQueryResult(
    classroom.tasks.get,
    isSettled ? { classId, slug, task: address } : "skip",
    undefined
  );
  if (QueryResult.isFailure(read)) {
    if (isLostAccess(read.error)) {
      throw read.error;
    }
    return isDenied(read.error) ? (
      <ClassMissingBody />
    ) : (
      <DataFailure onRetry={reloadPage} />
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
        <TaskWorkTable task={task} />
      ) : (
        <HandIn task={task} />
      )}
    </div>
  );
}

/** What a task asks, its deadline, its points, and what late work gets, one fact per line. */
function TaskDetails({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="wrap-anywhere font-semibold text-lg" dir="auto">
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
        <dt className="text-muted-foreground">{t("task-status")}</dt>
        <dd>
          <TaskStanding task={task} />
        </dd>
      </dl>
      <p className="wrap-anywhere whitespace-pre-wrap text-sm" dir="auto">
        {task.text}
      </p>
    </section>
  );
}

/**
 * The student's hand-in: one field and Hand in, or Hand in again once work is in. The work shows as
 * handed in at once, and a refusal, such as a task that closed at its deadline, brings the text back
 * with the toast every School action uses.
 */
function HandIn({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const submit = useMutation(classroom.tasks.submit);
  const [text, setText] = useState("");
  const id = useId();
  const body = Str.trim(text);
  const ready = Schema.is(TaskText)(body);

  const handIn = () => {
    if (!ready) {
      return;
    }
    setText("");
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
      () => {
        setText((current) => (current === "" ? body : current));
        toastForumFailure();
      }
    );
  };

  return (
    <form action={handIn} className="flex flex-col gap-2">
      <label className="font-medium text-sm" htmlFor={`${id}-work`}>
        {t("task-work")}
      </label>
      <Textarea
        className="min-h-40"
        dir="auto"
        id={`${id}-work`}
        onChange={(event) => setText(event.target.value)}
        value={text}
      />
      <div className="flex justify-end">
        <Button disabled={!ready} type="submit">
          {task.mine === null ? t("task-hand-in") : t("task-hand-in-again")}
        </Button>
      </div>
    </form>
  );
}

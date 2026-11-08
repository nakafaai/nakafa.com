import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  ChartBarLineIcon,
  Edit02Icon,
  PencilEdit02Icon,
  PlayIcon,
  TaskEdit01Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TaskText } from "@repo/backend/confect/classroom/tasks/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { buttonVariants } from "@repo/design-system/lib/button";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Option,
  Schema,
  String as Str,
} from "effect";
import { createContext, use, useId, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
} from "@/components/shared/pane";
import { usePanes } from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { ClassMissingBody } from "@/components/tenant/classes/missing";
import { useClassScope } from "@/components/tenant/classes/scope";
import { EditTaskDialog } from "@/components/tenant/classes/tasks/edit";
import { TaskMissingTable } from "@/components/tenant/classes/tasks/missing";
import {
  type ClassTask,
  submitUpdate,
} from "@/components/tenant/classes/tasks/optimistic";
import { TaskStanding } from "@/components/tenant/classes/tasks/standing";
import { TaskWorkTable } from "@/components/tenant/classes/tasks/work";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { useClockZone } from "@/components/tenant/settings/time";
import { Link } from "@/lib/routing/link";

/** The task the pane shows, which every part of the pane reads. */
const OpenTaskContext = createContext<ClassTask | null>(null);

/** Reads the task the pane around the caller shows. */
function useOpenTask() {
  const task = use(OpenTaskContext);

  if (task === null) {
    throw new Error("useOpenTask must be used within an open task");
  }

  return task;
}

/**
 * The pane of the open task, at the screen's right beside the list: nothing while no task is open,
 * and the task the list or an address opened, by its address.
 */
export function TaskDetail({ rows }: { rows: readonly ClassTask[] }) {
  const open = usePanes((state) => state.open);

  return Option.match(open, {
    onNone: () => null,
    onSome: (address) => (
      <OpenTask
        address={address}
        key={address}
        listed={Arr.findFirst(rows, (row) => row.slug === address)}
      />
    ),
  });
}

/**
 * One task, read live by its address. The row the list holds draws it at once, so a press shows
 * the task in the same frame, and the read keeps it current. A task the class does not hold shows
 * the missing state, a failed read its sentence and Try again, and a viewer who lost the school's
 * access is sent to the refused page.
 */
function OpenTask({
  address,
  listed,
}: {
  address: string;
  listed: Option.Option<ClassTask>;
}) {
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const read = useQuery(
    classroom.tasks.get,
    isSettled ? { classId, slug, task: address } : "skip"
  );

  if (QueryResult.isFailure(read)) {
    if (isLostAccess(read.error)) {
      throw read.error;
    }
    return (
      <PaneBody>
        {isDenied(read.error) ? (
          <ClassMissingBody />
        ) : (
          <LoadFailure onRetry={reloadPage} />
        )}
      </PaneBody>
    );
  }
  const task = QueryResult.isSuccess(read) ? Option.some(read.value) : listed;

  if (Option.isNone(task)) {
    return null;
  }

  return (
    <OpenTaskContext value={task.value}>
      <TaskHeader />
      <TaskBody />
    </OpenTaskContext>
  );
}

/**
 * What the pane holds under its header: a task built from an exam opens the exam player, its
 * teacher reads the work handed in, a student of the class hands work in, and anyone else reads
 * the task alone.
 */
function TaskBody() {
  const task = useOpenTask();
  const { can } = useClassScope();

  if (task.exam !== null) {
    return <ExamTask />;
  }
  if (Arr.contains(can, "task.manage")) {
    return <TeacherTask />;
  }
  if (Arr.contains(can, "task.submit")) {
    return <HandIn />;
  }
  return (
    <PaneBody>
      <TaskInfo />
    </PaneBody>
  );
}

/** The pane's header: the task's title, and its deadline under it. */
function TaskHeader() {
  const task = useOpenTask();
  const format = useFormatter();
  const timeZone = useClockZone();

  return (
    <PaneHeader
      description={format.dateTime(
        DateTime.toDateUtc(DateTime.makeUnsafe(task.deadline)),
        { dateStyle: "medium", timeStyle: "short", timeZone }
      )}
      icon={<HugeIcons className="size-5 shrink-0" icon={TaskEdit01Icon} />}
      title={task.title}
    />
  );
}

/** What a task asks, then its deadline, its points, what late work gets, who gets it, and where it stands. */
function TaskInfo() {
  const t = useTranslations("Classroom");
  const task = useOpenTask();
  const format = useFormatter();
  const timeZone = useClockZone();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm wrap-anywhere whitespace-pre-wrap" dir="auto">
        {task.text}
      </p>
      <PaneFacts>
        <PaneFact label={t("task-deadline")}>
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(task.deadline)),
            { dateStyle: "full", timeStyle: "short", timeZone }
          )}
        </PaneFact>
        <PaneFact label={t("task-points")}>{task.points}</PaneFact>
        <PaneFact label={t("task-late")}>
          {t(`task-late-${task.latePolicy}`)}
        </PaneFact>
        <PaneFact label={t("task-reach")}>
          {task.targets === null
            ? t("task-reach-class")
            : t("task-reach-count", { count: task.targets.length })}
        </PaneFact>
        <PaneFact label={t("task-status")}>
          <TaskStanding task={task} />
        </PaneFact>
      </PaneFacts>
    </div>
  );
}

/**
 * The teacher's task: what it asks, then the work handed in with its own search over the students'
 * names, and the students who have handed nothing in; Edit task in the footer.
 */
function TeacherTask() {
  const t = useTranslations("Classroom");
  const task = useOpenTask();
  const [openings, setOpenings] = useState(0);

  return (
    <>
      <PaneBody>
        <div className="flex flex-col gap-6">
          <TaskInfo />
          <TableFiltersProvider>
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">{t("task-submissions")}</h3>
                <TableSearch placeholder={t("task-work-search")} />
              </div>
              <TaskWorkTable task={task} />
            </section>
            <TaskMissingTable task={task} />
          </TableFiltersProvider>
        </div>
      </PaneBody>
      <PaneFooter>
        <Button
          onClick={() => setOpenings((count) => count + 1)}
          variant="outline"
        >
          <HugeIcons aria-hidden="true" icon={PencilEdit02Icon} />
          {t("task-edit")}
        </Button>
      </PaneFooter>
      {openings === 0 ? null : <EditTaskDialog key={openings} task={task} />}
    </>
  );
}

/**
 * The student's hand-in: what the task asks, then one field that holds the work they handed in, and Hand in in the
 * footer, which waits disabled until the field holds new work. The work shows as handed in at once and stays in the
 * field, so the student reads and changes it there. A task that closes at its deadline says so once that passes, and
 * takes no more work. A refusal the page could not foresee shows the toast every School action uses, and the field
 * keeps the text.
 */
function HandIn() {
  const t = useTranslations("Classroom");
  const task = useOpenTask();
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
    <>
      <PaneBody>
        <div className="flex flex-col gap-6">
          <TaskInfo />
          <form action={handIn} id={`${id}-form`}>
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
          </form>
        </div>
      </PaneBody>
      <PaneFooter>
        <Button disabled={!ready} form={`${id}-form`} type="submit">
          {t("task-hand-in")}
        </Button>
      </PaneFooter>
    </>
  );
}

/**
 * A task built from an exam: what it asks and its facts, then for a student Start, which opens the
 * one exam player on the task's run and enters it with the run's token, and for its teacher the
 * exam's questions in the editor, the run's results, and Edit task.
 */
function ExamTask() {
  const t = useTranslations("Classroom");
  const task = useOpenTask();
  const { can, slug } = useClassScope();
  const [openings, setOpenings] = useState(0);

  if (task.exam === null) {
    return null;
  }
  const run = { exam: task.exam.examId, sitting: task.exam.sittingId, slug };

  return (
    <>
      <PaneBody>
        <TaskInfo />
      </PaneBody>
      <PaneFooter>
        {Arr.contains(can, "task.manage") ? (
          <>
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={run}
              to="/school/$slug/exams/$exam/edit"
            >
              <HugeIcons aria-hidden="true" icon={Edit02Icon} />
              {t("task-questions")}
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={run}
              to="/school/$slug/exams/$exam/sittings/$sitting/results"
            >
              <HugeIcons aria-hidden="true" icon={ChartBarLineIcon} />
              {t("task-results")}
            </Link>
            <Button onClick={() => setOpenings((count) => count + 1)}>
              <HugeIcons aria-hidden="true" icon={PencilEdit02Icon} />
              {t("task-edit")}
            </Button>
          </>
        ) : null}
        {Arr.contains(can, "task.submit") ? (
          <Link
            className={buttonVariants()}
            hash={task.exam.token}
            params={{ sitting: task.exam.sittingId, slug }}
            to="/school/$slug/sittings/$sitting"
          >
            <HugeIcons aria-hidden="true" icon={PlayIcon} />
            {t("task-start")}
          </Link>
        ) : null}
      </PaneFooter>
      {openings === 0 ? null : <EditTaskDialog key={openings} task={task} />}
    </>
  );
}

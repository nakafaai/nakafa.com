import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";
import { changeLoaded, withPage } from "@/lib/data/loaded";

/** One task of a class, as its pages show it. */
export type ClassTask = Ref.Returns<typeof classroom.tasks.get>;

/** One student's work, as the teacher's table shows it. */
export type TaskWork = Ref.Returns<
  typeof classroom.tasks.submissions
>["page"][number];

const { get, list, submissions } = classroom.tasks;

/** Writes what `change` makes of the task at `slug` wherever the store holds it: its page and the class's list. */
const changeTask = (
  localStore: LocalStore.OptimisticLocalStore,
  slug: string,
  change: (task: ClassTask) => ClassTask
) => {
  changeLoaded(localStore, get, (task, args) =>
    args.task === slug ? Option.some(change(task)) : Option.none()
  );
  changeLoaded(localStore, list, (value) =>
    Arr.some(value.page, (task) => task.slug === slug)
      ? Option.some(
          withPage(value, (page) =>
            Arr.map(page, (task) => (task.slug === slug ? change(task) : task))
          )
        )
      : Option.none()
  );
};

/**
 * Shows the student's work as handed in at once, at `at`, with the text it hands in: late after the deadline,
 * and counted when it is the student's first.
 */
export const submitUpdate =
  (at: number): OptimisticUpdate<typeof classroom.tasks.submit> =>
  (localStore, args) => {
    changeTask(localStore, args.task, (task) => ({
      ...task,
      handedIn: task.mine === null ? task.handedIn + 1 : task.handedIn,
      mine: {
        late: at > task.deadline,
        score: task.mine?.score ?? null,
        text: args.text,
        updatedAt: at,
      },
    }));
  };

/** Shows a task's new title, text, deadline, points and late policy at once, under its own address. */
export const editUpdate: OptimisticUpdate<typeof classroom.tasks.edit> = (
  localStore,
  args
) => {
  changeTask(localStore, args.task, (task) => ({
    ...task,
    category: args.category,
    deadline: args.deadline,
    latePolicy: args.latePolicy,
    points: args.points,
    targets: args.targets,
    text: args.text,
    title: args.title,
  }));
};

/** Shows the points a teacher gives a student's work at once. */
export const scoreUpdate: OptimisticUpdate<typeof classroom.tasks.score> = (
  localStore,
  args
) => {
  changeLoaded(localStore, submissions, (value) =>
    Arr.some(value.page, (work) => work.id === args.submissionId)
      ? Option.some(
          withPage(value, (page) =>
            Arr.map(page, (work) =>
              work.id === args.submissionId
                ? { ...work, score: args.points }
                : work
            )
          )
        )
      : Option.none()
  );
};

/** Takes the task at `slug` out of every list of the class that holds it. */
const leaveLists = (
  localStore: LocalStore.OptimisticLocalStore,
  slug: string
) => {
  changeLoaded(localStore, list, (value) =>
    Arr.some(value.page, (task) => task.slug === slug)
      ? Option.some(
          withPage(value, (page) =>
            Arr.filter(page, (task) => task.slug !== slug)
          )
        )
      : Option.none()
  );
};

/**
 * Takes a deleted task out of the class's lists at once, wherever a list holds it; a refusal brings
 * it back, because Convex drops the update when the mutation fails.
 */
export const removeUpdate: OptimisticUpdate<typeof classroom.tasks.remove> = (
  localStore,
  args
) => leaveLists(localStore, args.task);

/** Takes an archived task out of the live list at once; a refusal brings it back. */
export const archiveUpdate: OptimisticUpdate<typeof classroom.tasks.archive> = (
  localStore,
  args
) => leaveLists(localStore, args.task);

/** Takes a restored task out of the archived list at once; a refusal brings it back. */
export const restoreUpdate: OptimisticUpdate<typeof classroom.tasks.restore> = (
  localStore,
  args
) => leaveLists(localStore, args.task);

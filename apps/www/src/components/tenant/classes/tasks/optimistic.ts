import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";

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
  for (const query of localStore.getAllQueries(get)) {
    if (Option.isSome(query.value) && query.args.task === slug) {
      localStore.setQuery(
        get,
        query.args,
        Option.some(change(query.value.value))
      );
    }
  }
  for (const query of localStore.getAllQueries(list)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(query.value.value.page, (task) => task.slug === slug)
    ) {
      localStore.setQuery(
        list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (task) =>
            task.slug === slug ? change(task) : task
          ),
        })
      );
    }
  }
};

/**
 * Shows the student's work as handed in at once, at `at`: late after the deadline,
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
        updatedAt: at,
      },
    }));
  };

/** Shows a task's new deadline at once. */
export const rescheduleUpdate: OptimisticUpdate<
  typeof classroom.tasks.reschedule
> = (localStore, args) => {
  changeTask(localStore, args.task, (task) => ({
    ...task,
    deadline: args.deadline,
  }));
};

/** Shows the points a teacher gives a student's work at once. */
export const scoreUpdate: OptimisticUpdate<typeof classroom.tasks.score> = (
  localStore,
  args
) => {
  for (const query of localStore.getAllQueries(submissions)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(query.value.value.page, (work) => work.id === args.submissionId)
    ) {
      localStore.setQuery(
        submissions,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (work) =>
            work.id === args.submissionId
              ? { ...work, score: args.points }
              : work
          ),
        })
      );
    }
  }
};

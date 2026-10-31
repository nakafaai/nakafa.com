import {
  LatePolicy,
  TaskPoints,
  TaskText,
  TaskTitle,
} from "@repo/backend/confect/classroom/tasks/task";
import { Option, Schema, String as Str } from "effect";
import {
  deadlineOf,
  localDeadline,
} from "@/components/tenant/classes/tasks/deadline";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";

/**
 * What a task's form holds while the teacher writes it: the title and the text as typed, the deadline as the
 * browser's date and time field holds it, the points as the number field holds them, and the late policy.
 */
export const TaskDraft = Schema.Struct({
  deadline: Schema.String,
  latePolicy: LatePolicy,
  points: Schema.NullOr(Schema.Finite),
  text: Schema.String,
  title: Schema.String,
});

/** The form of a new task: nothing written yet, worth 100 points, and late work accepted. */
export const EMPTY_DRAFT: typeof TaskDraft.Type = {
  deadline: "",
  latePolicy: "accept",
  points: 100,
  text: "",
  title: "",
};

/** The form of a task as it stands, its deadline in the browser's own time. */
export const draftOf = (task: ClassTask): typeof TaskDraft.Type => ({
  deadline: localDeadline(task.deadline),
  latePolicy: task.latePolicy,
  points: task.points,
  text: task.text,
  title: task.title,
});

/**
 * The task a form names once every field holds what the server accepts: the trimmed title and text, the instant of
 * the deadline, the points, and the late policy. None while any field does not.
 */
export const checkedDraft = (draft: typeof TaskDraft.Type) =>
  Option.map(
    Option.all({
      deadline: deadlineOf(draft.deadline),
      points: Option.filter(
        Option.fromNullOr(draft.points),
        Schema.is(TaskPoints)
      ),
      text: Option.liftPredicate(Str.trim(draft.text), Schema.is(TaskText)),
      title: Option.liftPredicate(Str.trim(draft.title), Schema.is(TaskTitle)),
    }),
    (fields) => ({ ...fields, latePolicy: draft.latePolicy })
  );

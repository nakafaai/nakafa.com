import { TaskTitle } from "@repo/backend/confect/classroom/tasks/task";
import { pipe, Schema, String as Str } from "effect";

/** Characters that a task title keeps on one line: line breaks and controls become a space. */
const LINE_BREAKS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;

/** Characters that a client key does not hold. */
const KEY_UNSAFE = /[^A-Za-z0-9-]/gu;

/** A Classroom title as a task title: one trimmed line of at most 120 characters, or none when nothing is left. */
export const taskTitleOf = (title: string) =>
  Schema.decodeOption(TaskTitle)(
    pipe(title.replace(LINE_BREAKS, " "), Str.trim, Str.slice(0, 120), Str.trim)
  );

/** The client key of one piece of Classroom work, which makes a second import find the task of the first. */
export const workKeyOf = (workId: string) =>
  pipe(`classroom-${workId.replace(KEY_UNSAFE, "-")}`, Str.slice(0, 64));

import { Id } from "@repo/backend/confect/_generated/id";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The title of a task: one trimmed line of 1 to 120 characters, which gives its address. */
export const TaskTitle = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(120)
);

/** What a task asks, or what a student hands in: trimmed, 1 to 8,000 characters. */
export const TaskText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(8000)
);

/** The points a task is worth, from 0 to 1,000. */
export const TaskPoints = Schema.Int.check(
  Schema.isBetween({ maximum: 1000, minimum: 0 })
);

/** The category a teacher files a task under, such as Homework: one trimmed line of 1 to 40 characters. */
export const TaskCategory = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(40)
);

/** The students a task goes to when it goes to part of its class: 1 to 200 of them. */
export const TaskTargets = Schema.Array(Id("tenantPeople")).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(200)
);

/**
 * What happens to work handed in after the deadline: it is taken and marked
 * late, or the task closes at its deadline and takes no more work.
 */
export const LatePolicy = Schema.Literals(["accept", "close"]);

/** The address of a task in its class, as `classSlugOf` forms it from the title. */
export const TaskAddress = Schema.String.check(
  Schema.isPattern(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u),
  Schema.isMaxLength(140)
);

/**
 * One task of a class (ADR 0025): its title and its address, what it asks,
 * sealed with the school key and bound to the class and the client key of its
 * creation, its deadline in UTC, its points, its late policy, how many students
 * have handed work in, and the scheduled runs of its deadline's notices. `category`
 * files it among the class's tasks. `targets` names the students it goes to when it
 * goes to part of the class, and without it the whole class is its target.
 */
export const taskValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  category: Schema.optionalKey(TaskCategory),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  deadline: Schema.Finite,
  handedIn: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  jobs: Schema.optionalKey(Schema.Array(Id("_scheduled_functions"))),
  latePolicy: LatePolicy,
  points: TaskPoints,
  sealedText: Sealed,
  slug: TaskAddress,
  targets: Schema.optionalKey(TaskTargets),
  tenantId: Id("tenants"),
  title: TaskTitle,
});

/**
 * The work one student hands in for one task: its text, sealed with the school
 * key and bound to the task and the student, when it came first and last, whether
 * it came after the deadline, and the points a teacher gave it.
 */
export const submissionValidator = Schema.Struct({
  classId: Id("classes"),
  createdAt: Schema.Finite,
  late: Schema.Boolean,
  personId: Id("tenantPeople"),
  score: Schema.optionalKey(TaskPoints),
  sealedText: Sealed,
  taskId: Id("classroomTasks"),
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/**
 * One task as a class shows it, with how many have handed in and the viewer's own work: its text, so the viewer
 * can read and change what they handed in, whether it came late, and its points.
 */
export const TaskView = Schema.Struct({
  category: Schema.NullOr(TaskCategory),
  deadline: Schema.Finite,
  handedIn: Schema.Int,
  id: Id("classroomTasks"),
  latePolicy: LatePolicy,
  mine: Schema.NullOr(
    Schema.Struct({
      late: Schema.Boolean,
      score: Schema.NullOr(Schema.Int),
      text: Schema.String,
      updatedAt: Schema.Finite,
    })
  ),
  points: TaskPoints,
  slug: TaskAddress,
  targets: Schema.NullOr(TaskTargets),
  text: Schema.String,
  title: TaskTitle,
});

/**
 * Where a task stands for the student who reads it: no work handed in yet, work handed in on time or late, or work
 * that has its points.
 */
export const TaskStanding = Schema.Literals([
  "open",
  "handedIn",
  "late",
  "scored",
]);

/** Where a task stands for its reader, from the reader's own work. */
export const standingOf = (
  mine: (typeof TaskView.Type)["mine"]
): typeof TaskStanding.Type => {
  if (mine === null) {
    return "open";
  }
  if (mine.score !== null) {
    return "scored";
  }
  return mine.late ? "late" : "handedIn";
};

/** One student's work as the teacher reads it. */
export const SubmissionView = Schema.Struct({
  id: Id("classroomSubmissions"),
  late: Schema.Boolean,
  person: Schema.Struct({ id: Id("tenantPeople"), name: Schema.String }),
  score: Schema.NullOr(Schema.Int),
  text: Schema.String,
  updatedAt: Schema.Finite,
});

/** A student a task reaches who has handed nothing in, as its teacher reads them. */
export const MissingStudent = Schema.Struct({
  id: Id("tenantPeople"),
  name: Schema.String,
});

/** The sealed field of a task's text, bound to the row that names it (ADR 0030). */
export const taskField = (
  row: Pick<typeof taskValidator.Type, "classId" | "clientKey">
) => ({
  field: "sealedText",
  row: [row.classId, row.clientKey],
  table: "classroomTasks",
});

/** The sealed field of a submission's text, bound to its task and its student. */
export const submissionField = (
  row: Pick<typeof submissionValidator.Type, "personId" | "taskId">
) => ({
  field: "sealedText",
  row: [row.taskId, row.personId],
  table: "classroomSubmissions",
});

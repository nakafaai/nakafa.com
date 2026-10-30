import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  ScoreOutOfRange,
  TaskClosed,
} from "@repo/backend/confect/classroom/errors";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import {
  LatePolicy,
  SubmissionView,
  TaskAddress,
  TaskPoints,
  TaskText,
  TaskTitle,
  TaskView,
} from "@repo/backend/confect/classroom/tasks/task";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

const classArgs = { classId: Id("classes"), slug: TenantSlug };

/**
 * The tasks of a class (ADR 0025). Whoever reads the class reads its tasks by
 * deadline and each one by its address. A subject teacher publishes a task, moves
 * its deadline, reads the work handed in, and gives it points. A member of the
 * class hands work in, and hands it in again until the deadline, or after it when
 * the task takes late work. A task of another class is refused as a missing
 * object.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => classArgs,
      item: () => TaskView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ ...classArgs, task: TaskAddress }),
      returns: () => TaskView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "publish",
      args: () => ({
        ...classArgs,
        clientKey: ClientKey,
        deadline: Schema.Finite,
        latePolicy: LatePolicy,
        points: TaskPoints,
        text: TaskText,
        title: TaskTitle,
      }),
      returns: () => TaskView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "task.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reschedule",
      args: () => ({
        ...classArgs,
        deadline: Schema.Finite,
        task: TaskAddress,
      }),
      returns: () => TaskView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "task.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "submit",
      args: () => ({ ...classArgs, task: TaskAddress, text: TaskText }),
      returns: () => TaskView,
      error: () => Schema.Union([AccessDenied, TaskClosed]),
    }).middleware(ClassAccess, { action: "task.submit", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "submissions",
      args: () => ({ ...classArgs, task: TaskAddress }),
      item: () => SubmissionView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "task.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "score",
      args: () => ({
        ...classArgs,
        points: TaskPoints,
        submissionId: Id("classroomSubmissions"),
      }),
      returns: () => SubmissionView,
      error: () => Schema.Union([AccessDenied, ScoreOutOfRange]),
    }).middleware(ClassAccess, { action: "task.manage", arg: "classId" })
  );

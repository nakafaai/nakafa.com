import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  ScheduledLimit,
  ScheduledPast,
} from "@repo/backend/confect/classroom/errors";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { PostText } from "@repo/backend/confect/classroom/posts/post";
import { ScheduledView } from "@repo/backend/confect/classroom/posts/scheduled";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The class and school that every public function of the scheduled announcements names. */
const classArgs = { classId: Id("classes"), slug: TenantSlug };

/**
 * The announcements of a class that wait for their time (ADR 0025). A subject teacher schedules one, and reads, moves,
 * rewrites and cancels their own. No reader of the class meets it until its time, when `release`, which is internal,
 * posts it as any announcement is posted.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => classArgs,
      returns: () => Schema.Array(ScheduledView),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "schedule",
      args: () => ({
        ...classArgs,
        clientKey: ClientKey,
        email: Schema.Boolean,
        publishAt: Schema.Finite,
        text: PostText,
      }),
      returns: () => ScheduledView,
      error: () => Schema.Union([AccessDenied, ScheduledLimit, ScheduledPast]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "edit",
      args: () => ({
        ...classArgs,
        publishAt: Schema.Finite,
        scheduledId: Id("classroomScheduled"),
        text: PostText,
      }),
      returns: () => ScheduledView,
      error: () => Schema.Union([AccessDenied, ScheduledPast]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "cancel",
      args: () => ({ ...classArgs, scheduledId: Id("classroomScheduled") }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "release",
      args: () => ({ classId: Id("classes"), clientKey: ClientKey }),
      returns: () => Schema.Null,
    })
  );

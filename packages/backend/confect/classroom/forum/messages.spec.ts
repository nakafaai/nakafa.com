import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  MentionRefused,
  MessageHidden,
} from "@repo/backend/confect/classroom/forum/errors";
import { Mentions } from "@repo/backend/confect/classroom/forum/mention";
import {
  ClientKey,
  MessageText,
  MessageView,
} from "@repo/backend/confect/classroom/forum/message";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The messages of a class's channels. Whoever reads the forum reads a channel's
 * messages, newest first. A member of the class or a subject teacher sends a
 * message and edits their own, and a locked class takes no new one. The school's
 * leaders read the forum and write nothing in it (ADR 0025).
 * Whoever manages the forum hides a message. A channel or a message of another
 * class is refused as a missing object.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "page",
      args: () => ({
        channelId: Id("classroomChannels"),
        classId: Id("classes"),
        slug: TenantSlug,
      }),
      item: () => MessageView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "send",
      args: () => ({
        channelId: Id("classroomChannels"),
        classId: Id("classes"),
        clientKey: ClientKey,
        mentions: Mentions,
        slug: TenantSlug,
        text: MessageText,
      }),
      returns: () => MessageView,
      error: () => Schema.Union([AccessDenied, MentionRefused]),
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "edit",
      args: () => ({
        classId: Id("classes"),
        messageId: Id("classroomMessages"),
        slug: TenantSlug,
        text: MessageText,
      }),
      returns: () => MessageView,
      error: () => Schema.Union([AccessDenied, MessageHidden]),
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "hide",
      args: () => ({
        classId: Id("classes"),
        messageId: Id("classroomMessages"),
        slug: TenantSlug,
      }),
      returns: () => MessageView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.manage", arg: "classId" })
  );

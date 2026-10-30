import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  DiscussionsClosed,
  MentionRefused,
} from "@repo/backend/confect/classroom/forum/errors";
import { Mentions } from "@repo/backend/confect/classroom/forum/mention";
import {
  ClientKey,
  DiscussionNumber,
  MessageText,
  MessageView,
} from "@repo/backend/confect/classroom/forum/message";
import {
  DiscussionTitle,
  ThreadView,
} from "@repo/backend/confect/classroom/forum/thread";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The numbered discussions of a class's forum (ADR 0025). A member of the class
 * or a subject teacher opens one in a channel with a title and a first message,
 * and replies in it; a student opens one only while the school lets students
 * open discussions. Whoever reads the forum reads a discussion by its number and
 * its replies, newest first. A discussion of another class is refused as a
 * missing object.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => ({
        channelId: Id("classroomChannels"),
        classId: Id("classes"),
        clientKey: ClientKey,
        mentions: Mentions,
        slug: TenantSlug,
        text: MessageText,
        title: DiscussionTitle,
      }),
      returns: () => ThreadView,
      error: () =>
        Schema.Union([AccessDenied, DiscussionsClosed, MentionRefused]),
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({
        classId: Id("classes"),
        number: DiscussionNumber,
        slug: TenantSlug,
      }),
      returns: () => ThreadView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "replies",
      args: () => ({
        classId: Id("classes"),
        number: DiscussionNumber,
        slug: TenantSlug,
      }),
      item: () => MessageView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reply",
      args: () => ({
        classId: Id("classes"),
        clientKey: ClientKey,
        mentions: Mentions,
        number: DiscussionNumber,
        slug: TenantSlug,
        text: MessageText,
      }),
      returns: () => MessageView,
      error: () => Schema.Union([AccessDenied, MentionRefused]),
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  );

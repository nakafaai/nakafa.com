import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { PinLimit } from "@repo/backend/confect/classroom/errors";
import { VoteRefused } from "@repo/backend/confect/classroom/forum/errors";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { PollDraft } from "@repo/backend/confect/classroom/forum/poll";
import {
  PostVotes,
  VOTES_READ_LIMIT,
} from "@repo/backend/confect/classroom/posts/poll";
import { PostText, PostView } from "@repo/backend/confect/classroom/posts/post";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The announcements of a class, on its home (ADR 0025). Whoever reads the forum
 * reads them, newest first, and the pinned ones on their own. A subject teacher
 * posts one, with the choice to send it by email too, edits or removes their own,
 * and pins any announcement of the class. An announcement may ask a poll, which
 * whoever writes in the class votes on, and whose votes are read on their own. An
 * announcement of another class is refused as a missing object.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      item: () => PostView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "pinned",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => Schema.Array(PostView),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "votes",
      args: () => ({
        classId: Id("classes"),
        postIds: Schema.Array(Id("classroomPosts")).check(
          Schema.isMaxLength(VOTES_READ_LIMIT)
        ),
        slug: TenantSlug,
      }),
      returns: () => Schema.Array(PostVotes),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "vote",
      args: () => ({
        classId: Id("classes"),
        options: Schema.Array(Schema.Int),
        postId: Id("classroomPosts"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, VoteRefused]),
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "pin",
      args: () => ({
        classId: Id("classes"),
        pinned: Schema.Boolean,
        postId: Id("classroomPosts"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, PinLimit]),
    }).middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "publish",
      args: () => ({
        classId: Id("classes"),
        clientKey: ClientKey,
        email: Schema.Boolean,
        poll: Schema.NullOr(PollDraft),
        slug: TenantSlug,
        text: PostText,
      }),
      returns: () => PostView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "edit",
      args: () => ({
        classId: Id("classes"),
        postId: Id("classroomPosts"),
        slug: TenantSlug,
        text: PostText,
      }),
      returns: () => PostView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({
        classId: Id("classes"),
        postId: Id("classroomPosts"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "post.publish", arg: "classId" })
  );

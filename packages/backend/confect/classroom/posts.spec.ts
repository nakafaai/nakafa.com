import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { PostText, PostView } from "@repo/backend/confect/classroom/posts/post";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The announcements of a class, on its home (ADR 0025). Whoever reads the forum
 * reads them, newest first. A subject teacher posts one, with the choice to send
 * it by email too, and edits or removes their own. An announcement of another
 * class is refused as a missing object.
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
    FunctionSpec.publicMutation({
      name: "publish",
      args: () => ({
        classId: Id("classes"),
        clientKey: ClientKey,
        email: Schema.Boolean,
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

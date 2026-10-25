import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  ChannelName,
  ChannelView,
} from "@repo/backend/confect/classroom/forum/channel";
import {
  ChannelLimit,
  ChannelNameTaken,
} from "@repo/backend/confect/classroom/forum/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The channels of a class. Whoever may read the class reads its channels, the
 * general channel first, and an archived class keeps them readable. A subject
 * teacher of the class or an Admin adds a topic channel to an active class.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      item: () => ChannelView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "add",
      args: () => ({
        classId: Id("classes"),
        name: ChannelName,
        slug: TenantSlug,
      }),
      returns: () => ChannelView,
      error: () => Schema.Union([AccessDenied, ChannelLimit, ChannelNameTaken]),
    }).middleware(ClassAccess, { action: "forum.manage", arg: "classId" })
  );

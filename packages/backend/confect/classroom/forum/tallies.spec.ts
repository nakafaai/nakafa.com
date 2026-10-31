import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  ChannelArchived,
  MessageHidden,
  ReactionLimit,
  VoteRefused,
} from "@repo/backend/confect/classroom/forum/errors";
import { ReadPlace } from "@repo/backend/confect/classroom/forum/read";
import { Emoji, TallyView } from "@repo/backend/confect/classroom/forum/tally";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The reactions and the votes of a class's chats. Whoever reads the forum reads
 * the tallies of a place from the oldest message it has loaded. Whoever writes in
 * the class gives or takes back an emoji and votes in a poll; the school's leaders
 * read them and take no part. A message of another class is refused as a missing
 * object.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "since",
      args: () => ({
        classId: Id("classes"),
        place: ReadPlace,
        since: Schema.Finite,
        slug: TenantSlug,
      }),
      returns: () => Schema.Array(TallyView),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "react",
      args: () => ({
        classId: Id("classes"),
        emoji: Emoji,
        messageId: Id("classroomMessages"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          AccessDenied,
          ChannelArchived,
          MessageHidden,
          ReactionLimit,
        ]),
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "vote",
      args: () => ({
        classId: Id("classes"),
        messageId: Id("classroomMessages"),
        options: Schema.Array(Schema.Int),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          AccessDenied,
          ChannelArchived,
          MessageHidden,
          VoteRefused,
        ]),
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  );

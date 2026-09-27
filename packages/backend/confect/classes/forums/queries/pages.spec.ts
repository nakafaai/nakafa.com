import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessFailure } from "@repo/backend/confect/classes/access/spec";
import { ForumAttachmentErrorWire } from "@repo/backend/confect/classes/forums/attachments/spec";
import { ForumFailure } from "@repo/backend/confect/classes/forums/spec";
import { forumFeedPostValidator } from "@repo/backend/confect/classes/forums/validators";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getForumPosts",
    args: () => ({
      forumId: IdSchema("schoolClassForums"),
    }),
    returns: () => Schema.mutable(Schema.Array(forumFeedPostValidator)),
    error: () =>
      Schema.Union([
        AuthFailure,
        ClassAccessFailure,
        ForumFailure,
        ForumAttachmentErrorWire,
      ]),
  })
);

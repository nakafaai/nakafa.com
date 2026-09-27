import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import { ForumAttachmentError } from "@repo/backend/confect/classes/forums/attachments/spec";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import { forumFeedPostValidator } from "@repo/backend/confect/classes/forums/validators";
import Session from "@repo/backend/confect/middleware/session.spec";
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
        ClassAccessError,
        ForumError,
        ForumAttachmentError,
      ]),
  }).middleware(Session)
);

import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessFailure } from "@repo/backend/confect/classes/access/spec";
import { ForumFailure } from "@repo/backend/confect/classes/forums/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "markForumRead",
    args: () => ({
      forumId: IdSchema("schoolClassForums"),
      lastReadPostId: IdSchema("schoolClassForumPosts"),
    }),
    returns: () => Schema.Null,
    error: () => Schema.Union([AuthFailure, ClassAccessFailure, ForumFailure]),
  }).middleware(Atomic)
);

import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "markForumRead",
    args: () => ({
      forumId: IdSchema("schoolClassForums"),
      lastReadPostId: IdSchema("schoolClassForumPosts"),
    }),
    returns: () => Schema.Null,
    error: () => Schema.Union([AuthFailure, ClassAccessError, ForumError]),
  })
    .middleware(Session)
    .middleware(Atomic)
);

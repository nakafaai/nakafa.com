import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import postsTable from "@repo/backend/confect/_generated/tables/posts";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema, Struct } from "effect";

/** One post as its list shows it, with whether the viewer has liked it. */
const postRowValidator = Schema.Struct({
  ...Struct.pick(postsTable.Doc.fields, [
    "_id",
    "_creationTime",
    "text",
    "likeCount",
  ]),
  liked: Schema.Boolean,
});

/** Reads one page of an author's posts, newest first, for the people the profile shows them to. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicPaginatedQuery({
    name: "list",
    args: () => ({
      authorId: IdSchema("users"),
    }),
    item: () => postRowValidator,
    error: () => AuthFailure,
  }).middleware(Session)
);

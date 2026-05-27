import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const commentsMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addComment",
      args: Schema.Struct({
        parentId: Schema.optional(GenericId.GenericId("comments")),
        slug: Schema.String,
        text: Schema.String,
      }),
      returns: GenericId.GenericId("comments"),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteComment",
      args: Schema.Struct({ commentId: GenericId.GenericId("comments") }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "voteOnComment",
      args: Schema.Struct({
        commentId: GenericId.GenericId("comments"),
        vote: Schema.Literal(-1, 0, 1),
      }),
      returns: Schema.Null,
    })
  );

export { commentsMutationsGroup };

const commentsQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCommentsBySlug",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        slug: Schema.String,
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("comments"),
            downvoteCount: Schema.Number,
            parentId: Schema.optional(GenericId.GenericId("comments")),
            replyCount: Schema.Number,
            replyToText: Schema.optional(Schema.String),
            replyToUser: Schema.Union(
              Schema.Null,
              Schema.Struct({
                _id: GenericId.GenericId("users"),
                image: Schema.optional(
                  Schema.Union(Schema.Null, Schema.String)
                ),
                name: Schema.String,
              })
            ),
            replyToUserId: Schema.optional(GenericId.GenericId("users")),
            slug: Schema.String,
            text: Schema.String,
            upvoteCount: Schema.Number,
            user: Schema.Union(
              Schema.Null,
              Schema.Struct({
                _id: GenericId.GenericId("users"),
                image: Schema.optional(
                  Schema.Union(Schema.Null, Schema.String)
                ),
                name: Schema.String,
              })
            ),
            userId: GenericId.GenericId("users"),
          })
        ),
        pageStatus: Schema.optional(
          Schema.Union(
            Schema.Literal("SplitRecommended"),
            Schema.Literal("SplitRequired"),
            Schema.Null
          )
        ),
        splitCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCommentsByUserId",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        userId: GenericId.GenericId("users"),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("comments"),
            downvoteCount: Schema.Number,
            parentId: Schema.optional(GenericId.GenericId("comments")),
            replyCount: Schema.Number,
            replyToText: Schema.optional(Schema.String),
            replyToUserId: Schema.optional(GenericId.GenericId("users")),
            slug: Schema.String,
            text: Schema.String,
            upvoteCount: Schema.Number,
            userId: GenericId.GenericId("users"),
          })
        ),
        pageStatus: Schema.optional(
          Schema.Union(
            Schema.Literal("SplitRecommended"),
            Schema.Literal("SplitRequired"),
            Schema.Null
          )
        ),
        splitCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
      }),
    })
  );

export { commentsQueriesGroup };

const commentsGroup = GroupSpec.make("comments")
  .addGroup(commentsMutationsGroup)
  .addGroup(commentsQueriesGroup);

export { commentsGroup };

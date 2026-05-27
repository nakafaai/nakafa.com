import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const classesForumsQueriesPagesGroup = GroupSpec.make("pages").addFunction(
  FunctionSpec.publicQuery({
    name: "getForumPosts",
    args: Schema.Struct({ forumId: GenericId.GenericId("schoolClassForums") }),
    returns: Schema.Array(
      Schema.Struct({
        _creationTime: Schema.Number,
        _id: GenericId.GenericId("schoolClassForumPosts"),
        attachments: Schema.Array(
          Schema.Struct({
            _id: GenericId.GenericId("schoolClassForumPostAttachments"),
            mimeType: Schema.String,
            name: Schema.String,
            size: Schema.Number,
            url: Schema.Union(Schema.Null, Schema.String),
          })
        ),
        body: Schema.String,
        classId: GenericId.GenericId("schoolClasses"),
        createdBy: GenericId.GenericId("users"),
        editedAt: Schema.optional(Schema.Number),
        forumId: GenericId.GenericId("schoolClassForums"),
        isUnread: Schema.Boolean,
        mentions: Schema.Array(GenericId.GenericId("users")),
        myReactions: Schema.Array(Schema.String),
        parentId: Schema.optional(GenericId.GenericId("schoolClassForumPosts")),
        reactionCounts: Schema.Array(
          Schema.Struct({ count: Schema.Number, emoji: Schema.String })
        ),
        reactionUsers: Schema.Array(
          Schema.Struct({
            count: Schema.Number,
            emoji: Schema.String,
            reactors: Schema.Array(Schema.String),
          })
        ),
        replyCount: Schema.Number,
        replyToBody: Schema.optional(Schema.String),
        replyToUser: Schema.Union(
          Schema.Null,
          Schema.Struct({
            _id: GenericId.GenericId("users"),
            email: Schema.String,
            image: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
            name: Schema.String,
          })
        ),
        replyToUserId: Schema.optional(GenericId.GenericId("users")),
        sequence: Schema.Number,
        updatedAt: Schema.Number,
        user: Schema.Union(
          Schema.Null,
          Schema.Struct({
            _id: GenericId.GenericId("users"),
            email: Schema.String,
            image: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
            name: Schema.String,
          })
        ),
      })
    ),
  })
);

export { classesForumsQueriesPagesGroup };

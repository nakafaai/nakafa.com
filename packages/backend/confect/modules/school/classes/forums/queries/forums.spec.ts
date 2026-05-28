import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  schoolClassForumStatusSchema,
  schoolClassForumTagSchema,
} from "@repo/backend/confect/modules/school/classes.tables";
import { Schema } from "effect";

const classesForumsQueriesForumsGroup = GroupSpec.make("forums")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getForums",
      args: Schema.Struct({
        classId: GenericId.GenericId("schoolClasses"),
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        q: Schema.optional(Schema.String),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolClassForums"),
            body: Schema.String,
            classId: GenericId.GenericId("schoolClasses"),
            createdBy: GenericId.GenericId("users"),
            isPinned: Schema.Boolean,
            lastPostAt: Schema.Number,
            lastPostBy: Schema.optional(GenericId.GenericId("users")),
            myReactions: Schema.Array(Schema.String),
            nextPostSequence: Schema.Number,
            postCount: Schema.Number,
            reactionCounts: Schema.Array(
              Schema.Struct({ count: Schema.Number, emoji: Schema.String })
            ),
            schoolId: GenericId.GenericId("schools"),
            status: schoolClassForumStatusSchema,
            tag: schoolClassForumTagSchema,
            title: Schema.String,
            unreadCount: Schema.Number,
            updatedAt: Schema.Number,
            user: Schema.Union(
              Schema.Null,
              Schema.Struct({
                _id: GenericId.GenericId("users"),
                email: Schema.String,
                image: Schema.optional(
                  Schema.Union(Schema.Null, Schema.String)
                ),
                name: Schema.String,
              })
            ),
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
      name: "getForum",
      args: Schema.Struct({
        forumId: GenericId.GenericId("schoolClassForums"),
      }),
      returns: Schema.Struct({
        _creationTime: Schema.Number,
        _id: GenericId.GenericId("schoolClassForums"),
        body: Schema.String,
        classId: GenericId.GenericId("schoolClasses"),
        createdBy: GenericId.GenericId("users"),
        isPinned: Schema.Boolean,
        lastPostAt: Schema.Number,
        lastPostBy: Schema.optional(GenericId.GenericId("users")),
        myReactions: Schema.Array(Schema.String),
        nextPostSequence: Schema.Number,
        postCount: Schema.Number,
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
        schoolId: GenericId.GenericId("schools"),
        status: schoolClassForumStatusSchema,
        tag: schoolClassForumTagSchema,
        title: Schema.String,
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
      }),
    })
  );

export { classesForumsQueriesForumsGroup };

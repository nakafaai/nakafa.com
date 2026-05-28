import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  emailDigestTypesSchema,
  notificationEntityTypesSchema,
  notificationTypesSchema,
} from "@repo/backend/confect/modules/notifications/notifications.tables";
import { Schema } from "effect";

const notificationsMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateNotificationPreferences",
      args: Schema.Struct({
        emailDigest: emailDigestTypesSchema,
        emailEnabled: Schema.Boolean,
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setDisabledNotificationTypes",
      args: Schema.Struct({
        disabledTypes: Schema.Array(notificationTypesSchema),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setNotificationEntityMute",
      args: Schema.Struct({
        entityId: Schema.Union(
          GenericId.GenericId("schoolClassForums"),
          GenericId.GenericId("schoolClassForumPosts"),
          GenericId.GenericId("schoolClasses"),
          GenericId.GenericId("schools"),
          GenericId.GenericId("comments")
        ),
        entityType: notificationEntityTypesSchema,
        muted: Schema.Boolean,
      }),
      returns: Schema.Null,
    })
  );

export { notificationsMutationsGroup };

const notificationsQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getNotificationPreferences",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        disabledTypes: Schema.Array(notificationTypesSchema),
        emailDigest: emailDigestTypesSchema,
        emailEnabled: Schema.Boolean,
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listMutedNotificationEntities",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            entityId: Schema.Union(
              GenericId.GenericId("schoolClassForums"),
              GenericId.GenericId("schoolClassForumPosts"),
              GenericId.GenericId("schoolClasses"),
              GenericId.GenericId("schools"),
              GenericId.GenericId("comments")
            ),
            entityType: notificationEntityTypesSchema,
            mutedAt: Schema.Number,
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

export { notificationsQueriesGroup };

const notificationsGroup = GroupSpec.make("notifications")
  .addGroup(notificationsMutationsGroup)
  .addGroup(notificationsQueriesGroup);

export { notificationsGroup };

import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import type {
  emailDigestTypesSchema,
  notificationEntityIdSchema,
  notificationEntityTypesSchema,
  notificationTypesSchema,
} from "@repo/backend/confect/modules/notifications/notifications.tables";
import type { PaginationOptions } from "convex/server";
import { Clock, Effect, Option, Schema } from "effect";

const NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT = 10;

type EmailDigest = Schema.Schema.Type<typeof emailDigestTypesSchema>;
type NotificationEntityId = Schema.Schema.Type<
  typeof notificationEntityIdSchema
>;
type NotificationEntityType = Schema.Schema.Type<
  typeof notificationEntityTypesSchema
>;
type NotificationType = Schema.Schema.Type<typeof notificationTypesSchema>;

export class NotificationInvariantError extends Schema.TaggedError<NotificationInvariantError>()(
  "NotificationInvariantError",
  { message: Schema.String }
) {}

/** Creates one notification unless the recipient disabled or muted it. */
export const createNotification = Effect.fnUntraced(function* (args: {
  readonly actorId?: GenericId.GenericId<"users">;
  readonly entityId?: NotificationEntityId;
  readonly entityType: NotificationEntityType;
  readonly previewBody?: string;
  readonly previewTitle?: string;
  readonly recipientId: GenericId.GenericId<"users">;
  readonly type: NotificationType;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const preferences = yield* reader
    .table("notificationPreferences")
    .index("by_userId", (query) => query.eq("userId", args.recipientId))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (preferences?.disabledTypes.includes(args.type)) {
    return null;
  }

  const entityId = args.entityId;
  const mutedEntity =
    entityId && args.entityType !== "system"
      ? yield* reader
          .table("notificationEntityMutes")
          .index("by_userId_and_entityType_and_entityId", (query) =>
            query
              .eq("userId", args.recipientId)
              .eq("entityType", args.entityType)
              .eq("entityId", entityId)
          )
          .first()
          .pipe(Effect.map(Option.getOrNull))
      : null;

  if (mutedEntity) {
    return null;
  }

  yield* writer.table("notifications").insert({
    actorId: args.actorId,
    entityId: args.entityId,
    entityType: args.entityType,
    previewBody: args.previewBody,
    previewTitle: args.previewTitle,
    recipientId: args.recipientId,
    type: args.type,
  });

  const existingCount = yield* reader
    .table("notificationCounts")
    .index("by_userId", (query) => query.eq("userId", args.recipientId))
    .first()
    .pipe(Effect.map(Option.getOrNull));
  const updatedAt = yield* Clock.currentTimeMillis;

  if (!existingCount) {
    yield* writer.table("notificationCounts").insert({
      unreadCount: 1,
      updatedAt,
      userId: args.recipientId,
    });
    return null;
  }

  yield* writer.table("notificationCounts").patch(existingCount._id, {
    unreadCount: existingCount.unreadCount + 1,
    updatedAt,
  });

  return null;
});

/** Upserts notification preferences for a user. */
const upsertNotificationPreferences = Effect.fnUntraced(function* ({
  createDefaults,
  patch,
  userId,
}: {
  readonly createDefaults: {
    readonly disabledTypes: readonly NotificationType[];
    readonly emailDigest: EmailDigest;
    readonly emailEnabled: boolean;
  };
  readonly patch: {
    readonly disabledTypes?: readonly NotificationType[];
    readonly emailDigest?: EmailDigest;
    readonly emailEnabled?: boolean;
  };
  readonly userId: GenericId.GenericId<"users">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const preferences = yield* reader
    .table("notificationPreferences")
    .index("by_userId", (query) => query.eq("userId", userId))
    .first()
    .pipe(Effect.map(Option.getOrNull));
  const updatedAt = yield* Clock.currentTimeMillis;

  if (!preferences) {
    yield* writer.table("notificationPreferences").insert({
      ...createDefaults,
      disabledTypes: [...createDefaults.disabledTypes],
      updatedAt,
      userId,
    });
    return null;
  }

  yield* writer.table("notificationPreferences").patch(preferences._id, {
    ...patch,
    disabledTypes: patch.disabledTypes
      ? [...patch.disabledTypes]
      : patch.disabledTypes,
    updatedAt,
  });
  return null;
});

/** Updates email notification preference settings for the current user. */
export const updateNotificationPreferences = Effect.fnUntraced(
  function* (args: { emailDigest: EmailDigest; emailEnabled: boolean }) {
    const user = yield* requireAppUser();

    return yield* upsertNotificationPreferences({
      createDefaults: {
        disabledTypes: [],
        emailDigest: args.emailDigest,
        emailEnabled: args.emailEnabled,
      },
      patch: {
        emailDigest: args.emailDigest,
        emailEnabled: args.emailEnabled,
      },
      userId: user.appUser._id,
    });
  }
);

/** Replaces disabled notification types for the current user. */
export const setDisabledNotificationTypes = Effect.fnUntraced(function* (args: {
  disabledTypes: readonly NotificationType[];
}) {
  const user = yield* requireAppUser();

  return yield* upsertNotificationPreferences({
    createDefaults: {
      disabledTypes: args.disabledTypes,
      emailDigest: "weekly",
      emailEnabled: true,
    },
    patch: {
      disabledTypes: args.disabledTypes,
    },
    userId: user.appUser._id,
  });
});

/** Mutes or unmutes one notification entity for the current user. */
export const setNotificationEntityMute = Effect.fnUntraced(function* (args: {
  entityId: NotificationEntityId;
  entityType: NotificationEntityType;
  muted: boolean;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const existingRows = yield* reader
    .table("notificationEntityMutes")
    .index("by_userId_and_entityType_and_entityId", (query) =>
      query
        .eq("userId", user.appUser._id)
        .eq("entityType", args.entityType)
        .eq("entityId", args.entityId)
    )
    .take(NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT);

  if (existingRows.length >= NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT) {
    return yield* Effect.fail(
      new NotificationInvariantError({
        message: "Notification entity mute duplicate limit exceeded.",
      })
    );
  }

  if (!args.muted) {
    for (const row of existingRows) {
      yield* writer.table("notificationEntityMutes").delete(row._id);
    }
    return null;
  }

  if (existingRows.length > 0) {
    for (const row of existingRows.slice(1)) {
      yield* writer.table("notificationEntityMutes").delete(row._id);
    }
    return null;
  }

  const mutedAt = yield* Clock.currentTimeMillis;
  yield* writer.table("notificationEntityMutes").insert({
    entityId: args.entityId,
    entityType: args.entityType,
    mutedAt,
    userId: user.appUser._id,
  });

  return null;
});

/** Reads current notification preferences with defaults. */
export const getNotificationPreferences = Effect.fnUntraced(function* () {
  const reader = yield* DatabaseReader;
  const user = yield* requireAppUser();
  const preferences = yield* reader
    .table("notificationPreferences")
    .index("by_userId", (query) => query.eq("userId", user.appUser._id))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  return {
    disabledTypes: preferences?.disabledTypes ?? [],
    emailDigest: preferences?.emailDigest ?? "weekly",
    emailEnabled: preferences?.emailEnabled ?? true,
  };
});

/** Lists muted notification entities for the current user. */
export const listMutedNotificationEntities = Effect.fnUntraced(
  function* (args: { paginationOpts: PaginationOptions }) {
    const reader = yield* DatabaseReader;
    const user = yield* requireAppUser();
    const result = yield* reader
      .table("notificationEntityMutes")
      .index(
        "by_userId",
        (query) => query.eq("userId", user.appUser._id),
        "desc"
      )
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((row) => ({
        entityId: row.entityId,
        entityType: row.entityType,
        mutedAt: row.mutedAt,
      })),
    };
  }
);

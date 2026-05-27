import type { GenericId } from "@confect/core";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import type {
  emailDigestTypesSchema,
  notificationEntityIdSchema,
  notificationEntityTypesSchema,
  notificationTypesSchema,
} from "@repo/backend/confect/modules/notifications/notifications.tables";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import type { PaginationOptions } from "convex/server";
import { Clock, Effect, Schema } from "effect";

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
export const createNotification = Effect.fn("notifications.createNotification")(
  function* (
    ctx: ConvexMutationCtx,
    args: {
      readonly actorId?: GenericId.GenericId<"users">;
      readonly entityId?: NotificationEntityId;
      readonly entityType: NotificationEntityType;
      readonly previewBody?: string;
      readonly previewTitle?: string;
      readonly recipientId: GenericId.GenericId<"users">;
      readonly type: NotificationType;
    }
  ) {
    const preferences = yield* Effect.promise(() =>
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_userId", (query) => query.eq("userId", args.recipientId))
        .unique()
    );

    if (preferences?.disabledTypes.includes(args.type)) {
      return null;
    }

    const entityId = args.entityId;
    const mutedEntity =
      entityId && args.entityType !== "system"
        ? yield* Effect.promise(() =>
            ctx.db
              .query("notificationEntityMutes")
              .withIndex("by_userId_and_entityType_and_entityId", (query) =>
                query
                  .eq("userId", args.recipientId)
                  .eq("entityType", args.entityType)
                  .eq("entityId", entityId)
              )
              .unique()
          )
        : null;

    if (mutedEntity) {
      return null;
    }

    yield* Effect.promise(() =>
      ctx.db.insert("notifications", {
        actorId: args.actorId,
        entityId: args.entityId,
        entityType: args.entityType,
        previewBody: args.previewBody,
        previewTitle: args.previewTitle,
        recipientId: args.recipientId,
        type: args.type,
      })
    );

    const existingCount = yield* Effect.promise(() =>
      ctx.db
        .query("notificationCounts")
        .withIndex("by_userId", (query) => query.eq("userId", args.recipientId))
        .unique()
    );
    const updatedAt = yield* Clock.currentTimeMillis;

    if (!existingCount) {
      yield* Effect.promise(() =>
        ctx.db.insert("notificationCounts", {
          unreadCount: 1,
          updatedAt,
          userId: args.recipientId,
        })
      );
      return null;
    }

    yield* Effect.promise(() =>
      ctx.db.patch(existingCount._id, {
        unreadCount: existingCount.unreadCount + 1,
        updatedAt,
      })
    );

    return null;
  }
);

/** Upserts notification preferences for a user. */
const upsertNotificationPreferences = Effect.fn(
  "notifications.upsertPreferences"
)(function* ({
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
  const ctx = yield* MutationCtx;
  const preferences = yield* Effect.promise(() =>
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .unique()
  );
  const updatedAt = yield* Clock.currentTimeMillis;

  if (!preferences) {
    yield* Effect.promise(() =>
      ctx.db.insert("notificationPreferences", {
        ...createDefaults,
        disabledTypes: [...createDefaults.disabledTypes],
        updatedAt,
        userId,
      })
    );
    return null;
  }

  yield* Effect.promise(() =>
    ctx.db.patch(preferences._id, {
      ...patch,
      disabledTypes: patch.disabledTypes
        ? [...patch.disabledTypes]
        : patch.disabledTypes,
      updatedAt,
    })
  );
  return null;
});

/** Updates email notification preference settings for the current user. */
export const updateNotificationPreferences = Effect.fn(
  "notifications.updatePreferences"
)(function* (args: { emailDigest: EmailDigest; emailEnabled: boolean }) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);

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
});

/** Replaces disabled notification types for the current user. */
export const setDisabledNotificationTypes = Effect.fn(
  "notifications.setDisabledTypes"
)(function* (args: { disabledTypes: readonly NotificationType[] }) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);

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
export const setNotificationEntityMute = Effect.fn(
  "notifications.setEntityMute"
)(function* (args: {
  entityId: NotificationEntityId;
  entityType: NotificationEntityType;
  muted: boolean;
}) {
  const ctx = yield* MutationCtx;
  const user = yield* requireAppUser(ctx);
  const existingRows = yield* Effect.promise(() =>
    ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId_and_entityType_and_entityId", (query) =>
        query
          .eq("userId", user.appUser._id)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId)
      )
      .take(NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT)
  );

  if (existingRows.length >= NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT) {
    return yield* Effect.fail(
      new NotificationInvariantError({
        message: "Notification entity mute duplicate limit exceeded.",
      })
    );
  }

  if (!args.muted) {
    for (const row of existingRows) {
      yield* Effect.promise(() => ctx.db.delete(row._id));
    }
    return null;
  }

  if (existingRows.length > 0) {
    for (const row of existingRows.slice(1)) {
      yield* Effect.promise(() => ctx.db.delete(row._id));
    }
    return null;
  }

  const mutedAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.insert("notificationEntityMutes", {
      entityId: args.entityId,
      entityType: args.entityType,
      mutedAt,
      userId: user.appUser._id,
    })
  );

  return null;
});

/** Reads current notification preferences with defaults. */
export const getNotificationPreferences = Effect.fn(
  "notifications.getPreferences"
)(function* () {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const preferences = yield* Effect.promise(() =>
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (query) => query.eq("userId", user.appUser._id))
      .unique()
  );

  return {
    disabledTypes: preferences?.disabledTypes ?? [],
    emailDigest: preferences?.emailDigest ?? "weekly",
    emailEnabled: preferences?.emailEnabled ?? true,
  };
});

/** Lists muted notification entities for the current user. */
export const listMutedNotificationEntities = Effect.fn(
  "notifications.listMutedEntities"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const result = yield* Effect.promise(() =>
    ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId", (query) => query.eq("userId", user.appUser._id))
      .order("desc")
      .paginate(args.paginationOpts)
  );

  return {
    ...result,
    page: result.page.map((row) => ({
      entityId: row.entityId,
      entityType: row.entityType,
      mutedAt: row.mutedAt,
    })),
  };
});

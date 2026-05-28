import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  getNotificationPreferences as notificationsService_getNotificationPreferences,
  listMutedNotificationEntities as notificationsService_listMutedNotificationEntities,
  setDisabledNotificationTypes as notificationsService_setDisabledNotificationTypes,
  setNotificationEntityMute as notificationsService_setNotificationEntityMute,
  updateNotificationPreferences as notificationsService_updateNotificationPreferences,
} from "@repo/backend/confect/modules/notifications/notifications.service";
import { Effect, Layer } from "effect";

const notifications_mutations_setNotificationEntityMuteImpl = FunctionImpl.make(
  api,
  "notifications.mutations",
  "setNotificationEntityMute",
  (args) =>
    notificationsService_setNotificationEntityMute(args).pipe(
      Effect.catchTags({
        NotificationInvariantError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const notifications_queries_getNotificationPreferencesImpl = FunctionImpl.make(
  api,
  "notifications.queries",
  "getNotificationPreferences",
  (_args) =>
    notificationsService_getNotificationPreferences().pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const notifications_queries_listMutedNotificationEntitiesImpl =
  FunctionImpl.make(
    api,
    "notifications.queries",
    "listMutedNotificationEntities",
    (args) =>
      notificationsService_listMutedNotificationEntities(args).pipe(
        Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const notifications_mutations_updateNotificationPreferencesImpl =
  FunctionImpl.make(
    api,
    "notifications.mutations",
    "updateNotificationPreferences",
    (args) =>
      notificationsService_updateNotificationPreferences(args).pipe(
        Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const notifications_mutations_setDisabledNotificationTypesImpl =
  FunctionImpl.make(
    api,
    "notifications.mutations",
    "setDisabledNotificationTypes",
    (args) =>
      notificationsService_setDisabledNotificationTypes(args).pipe(
        Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const notificationsMutationsImpl = GroupImpl.make(
  api,
  "notifications.mutations"
)
  .pipe(
    Layer.provide(notifications_mutations_updateNotificationPreferencesImpl)
  )
  .pipe(Layer.provide(notifications_mutations_setDisabledNotificationTypesImpl))
  .pipe(Layer.provide(notifications_mutations_setNotificationEntityMuteImpl));

const notificationsQueriesImpl = GroupImpl.make(api, "notifications.queries")
  .pipe(Layer.provide(notifications_queries_getNotificationPreferencesImpl))
  .pipe(Layer.provide(notifications_queries_listMutedNotificationEntitiesImpl));

const notificationsImpl = GroupImpl.make(api, "notifications")
  .pipe(Layer.provide(notificationsMutationsImpl))
  .pipe(Layer.provide(notificationsQueriesImpl));

export const notificationsLayer = Layer.mergeAll(notificationsImpl);

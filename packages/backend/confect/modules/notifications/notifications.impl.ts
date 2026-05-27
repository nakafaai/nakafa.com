import { emailsLayer } from "@repo/backend/confect/modules/notifications/emails/emails.impl";
import { notificationsLayer as notificationFunctionsLayer } from "@repo/backend/confect/modules/notifications/notifications/notifications.impl";
import { Layer } from "effect";

export const notificationsLayer = Layer.mergeAll(
  emailsLayer,
  notificationFunctionsLayer
);

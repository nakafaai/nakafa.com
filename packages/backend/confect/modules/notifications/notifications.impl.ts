import { Layer } from "effect";
import { emailsLayer } from "./emails/emails.impl";
import { notificationsLayer as notificationFunctionsLayer } from "./notifications/notifications.impl";

export const notificationsLayer = Layer.mergeAll(
  emailsLayer,
  notificationFunctionsLayer
);

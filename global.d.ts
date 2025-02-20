import type id from "./messages/id.json";

type Messages = typeof id;

declare global {
  // Use type safe message keys with `next-intl`
  type IntlMessages = Messages;
}

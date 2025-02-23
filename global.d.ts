import type en from "./messages/en.json";
import type id from "./messages/id.json";

type Messages = typeof id | typeof en;

declare global {
  // Use type safe message keys with `next-intl`
  type IntlMessages = Messages;
}

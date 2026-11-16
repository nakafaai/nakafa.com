import { getRouteMessages } from "@repo/internationalization/src/messages";
import type { RouteMessagesInput } from "@/lib/i18n/messages";

/** The messages of one route in one locale: only the namespaces the route declares leave the server. */
export const routeMessagesHandler = ({
  data,
}: {
  readonly data: RouteMessagesInput;
}) => getRouteMessages(data.locale, data.namespaces);

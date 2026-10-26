import { pickRouteMessages } from "@repo/internationalization/src/namespaces";
import type { RouteMessagesInput } from "@/lib/i18n/messages.functions";

/** The messages of one route in one locale: only the namespaces the route declares leave the server. */
export const routeMessagesHandler = ({
  data,
}: {
  readonly data: RouteMessagesInput;
}) => pickRouteMessages(data.locale, data.namespaces);

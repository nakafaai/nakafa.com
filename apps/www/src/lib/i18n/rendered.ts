import { getRouteMessages } from "@repo/internationalization/src/messages";
import { createIsomorphicFn } from "@tanstack/react-start";
import {
  type RouteMessagesInput,
  readRouteMessages,
} from "@/lib/i18n/messages.functions";

/**
 * The messages of a route that the Worker renders, such as the signed-in screens
 * and the entry forms, which no prerendered page records. The server's render
 * calls the server function inside its own request. A move between pages in the
 * browser reads the locale's dictionary, which the browser downloads once, so it
 * sends the Worker no request for words, as the School root reads its own.
 */
export const readRenderedRouteMessages = createIsomorphicFn()
  .server((data: RouteMessagesInput) => readRouteMessages({ data }))
  .client((data: RouteMessagesInput) =>
    getRouteMessages(data.locale, data.namespaces)
  );

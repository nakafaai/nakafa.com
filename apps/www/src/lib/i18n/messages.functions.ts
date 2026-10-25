import { LocaleSchema } from "@repo/internationalization/src/locale";
import { MessageNamespaceSchema } from "@repo/internationalization/src/namespace";
import { pickRouteMessages } from "@repo/internationalization/src/namespaces";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The locale and the namespaces that one route renders, decoded at the server boundary. */
export const RouteMessagesInput = Schema.Struct({
  locale: LocaleSchema,
  namespaces: Schema.Array(MessageNamespaceSchema),
});

export type RouteMessagesInput = typeof RouteMessagesInput.Type;

/**
 * The messages of one route in one locale. The dictionaries are read on the
 * server only, and only the namespaces the route declares leave it.
 */
export const routeMessagesHandler = ({
  data,
}: {
  readonly data: RouteMessagesInput;
}) => pickRouteMessages(data.locale, data.namespaces);

/** Reads the messages of one route. Route loaders call it on the server and in the browser. */
export const readRouteMessages = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(RouteMessagesInput))
  .handler(routeMessagesHandler);

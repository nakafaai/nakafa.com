import { LocaleSchema } from "@repo/internationalization/src/locale";
import { MessageNamespaceSchema } from "@repo/internationalization/src/namespace";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The locale and the namespaces that one route renders, decoded at the server boundary. */
export const RouteMessagesInput = Schema.Struct({
  locale: LocaleSchema,
  namespaces: Schema.Array(MessageNamespaceSchema),
});

export type RouteMessagesInput = typeof RouteMessagesInput.Type;

/**
 * The messages of one route in one locale. The dictionaries live in the server
 * module, which this imports only when it runs, so the browser's bundle never
 * carries a dictionary.
 */
export const answerRouteMessages = async ({
  data,
}: {
  readonly data: RouteMessagesInput;
}) => {
  const { routeMessagesHandler } = await import("@/lib/i18n/messages.server");
  return routeMessagesHandler({ data });
};

/** Reads the messages of one route. Route loaders call it on the server and in the browser. */
export const readRouteMessages = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(RouteMessagesInput))
  .handler(answerRouteMessages);

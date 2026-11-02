import { LocaleSchema } from "@repo/internationalization/src/locale";
import { MessageNamespaceSchema } from "@repo/internationalization/src/namespace";
import { Schema } from "effect";

/** The locale and the namespaces that one route renders, decoded at the server boundary. */
export const RouteMessagesInput = Schema.Struct({
  locale: LocaleSchema,
  namespaces: Schema.Array(MessageNamespaceSchema),
});

export type RouteMessagesInput = typeof RouteMessagesInput.Type;

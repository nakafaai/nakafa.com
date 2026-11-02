import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { RouteMessagesInput } from "@/lib/i18n/messages";

/**
 * Reads the messages of one route in one locale. Route loaders call it on the
 * server and in the browser. The dictionaries live in the server module, which
 * this imports only when it runs, so the browser's bundle never carries one.
 */
export const readRouteMessages = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(RouteMessagesInput))
  .handler(async ({ data }) => {
    const { routeMessagesHandler } = await import("@/lib/i18n/messages.server");
    return routeMessagesHandler({ data });
  });

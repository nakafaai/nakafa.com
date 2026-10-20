import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ChatInput, LocaleInput } from "@/lib/account/access.server";
import {
  chatIndexScreenHandler,
  chatScreenHandler,
  chatSidebarScreenHandler,
  homeScreenHandler,
  notificationsScreenHandler,
  searchScreenHandler,
} from "@/lib/account/home.server";

/** Home: the onboarding gate, the account name and the recently viewed subjects. */
export const homeScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(homeScreenHandler);

/** The new chat page: its localized title and description. */
export const chatIndexScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(chatIndexScreenHandler);

/** The chat sidebar that every chat page shows. */
export const chatSidebarScreenFn = createServerFn({ method: "GET" }).handler(
  chatSidebarScreenHandler
);

/** A saved chat: its decoded id and its title, when the visitor may read it. */
export const chatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ChatInput))
  .handler(chatScreenHandler);

/** Search: the visitor's name for the greeting, and the search page head. */
export const searchScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(searchScreenHandler);

/** Notifications: the first page of the inbox and the inbox head. */
export const notificationsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(notificationsScreenHandler);

import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ChatInput, LocaleInput } from "@/lib/account/input";

/** Home: the onboarding gate, the account name and the recently viewed subjects. */
export const homeScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { homeScreenHandler } = await import("@/lib/account/home.server");
    return homeScreenHandler(options);
  });

/** The new chat page: its localized title and description. */
export const chatIndexScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { chatIndexScreenHandler } = await import(
      "@/lib/account/home.server"
    );
    return chatIndexScreenHandler(options);
  });

/** The chat sidebar that every chat page shows. */
export const chatSidebarScreenFn = createServerFn({ method: "GET" }).handler(
  async (options) => {
    const { chatSidebarScreenHandler } = await import(
      "@/lib/account/home.server"
    );
    return chatSidebarScreenHandler(options);
  }
);

/** A saved chat: its decoded id and its title, when the visitor may read it. */
export const chatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ChatInput))
  .handler(async (options) => {
    const { chatScreenHandler } = await import("@/lib/account/home.server");
    return chatScreenHandler(options);
  });

/** Search: the visitor's name for the greeting, and the search page head. */
export const searchScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { searchScreenHandler } = await import("@/lib/account/home.server");
    return searchScreenHandler(options);
  });

/** Notifications: the first page of the inbox and the inbox head. */
export const notificationsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { notificationsScreenHandler } = await import(
      "@/lib/account/home.server"
    );
    return notificationsScreenHandler(options);
  });

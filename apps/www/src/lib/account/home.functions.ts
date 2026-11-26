import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ChatInput } from "@/lib/account/input";

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

import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { LocaleInput } from "@/lib/account/input";

/** Settings: the account, or not found when the account is gone. */
export const settingsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { settingsScreenHandler } = await import(
      "@/lib/account/settings.server"
    );
    return settingsScreenHandler(options);
  });

/** Learning settings: the account, the preference and the curriculum programs. */
export const learningScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { learningScreenHandler } = await import(
      "@/lib/account/settings.server"
    );
    return learningScreenHandler(options);
  });

/** Memory settings: the first page of memories and whether memory is paused. */
export const memoryScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { memoryScreenHandler } = await import(
      "@/lib/account/settings.server"
    );
    return memoryScreenHandler(options);
  });

/** Subscriptions: whether the visitor holds the Pro subscription. */
export const subscriptionsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { subscriptionsScreenHandler } = await import(
      "@/lib/account/settings.server"
    );
    return subscriptionsScreenHandler(options);
  });

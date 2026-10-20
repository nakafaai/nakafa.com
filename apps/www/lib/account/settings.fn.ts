import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { LocaleInput } from "@/lib/account/access.server";
import {
  learningScreenHandler,
  memoryScreenHandler,
  settingsScreenHandler,
  subscriptionsScreenHandler,
} from "@/lib/account/settings.server";

/** Settings: the account, or not found when the account is gone. */
export const settingsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(settingsScreenHandler);

/** Learning settings: the account, the preference and the curriculum programs. */
export const learningScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(learningScreenHandler);

/** Memory settings: the first page of memories and whether memory is paused. */
export const memoryScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(memoryScreenHandler);

/** Subscriptions: whether the visitor holds the Pro subscription. */
export const subscriptionsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(subscriptionsScreenHandler);

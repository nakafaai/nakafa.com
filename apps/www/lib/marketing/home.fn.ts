import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { serverHandler } from "@/lib/server/fn";

/** The locale of the marketing home page. */
export const HomeInput = Schema.Struct({ locale: LocaleSchema });

export type HomeInput = typeof HomeInput.Type;

/** The featured try-out of the home page, read from the tagged content cache on the server. */
export const readHomeTryoutHandler = serverHandler(({ locale }: HomeInput) =>
  Effect.promise(() => readFeaturedTryout(locale))
);

/** Reads the featured try-out of the home page for one locale. */
export const readHomeTryout = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(HomeInput))
  .handler(readHomeTryoutHandler);

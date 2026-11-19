import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The locale of the marketing home page. */
export const HomeInput = Schema.Struct({ locale: LocaleSchema });

export type HomeInput = typeof HomeInput.Type;

/** Reads the curricula that the home page lists on the server. */
export const readHomeCurriculaFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(HomeInput))
  .handler(async ({ data }) => {
    const { readHomeCurriculaHandler } = await import(
      "@/lib/marketing/home.server"
    );
    return readHomeCurriculaHandler({ data });
  });

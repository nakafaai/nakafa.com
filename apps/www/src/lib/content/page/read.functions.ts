import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The locale and the public path of one legal page, as the route receives them. */
export const LegalPageInput = Schema.Struct({
  locale: LocaleSchema,
  publicPath: Schema.String,
});

export type LegalPageInput = typeof LegalPageInput.Type;

/**
 * Reads the head facts of one legal page, from the route's loader on the server
 * and in the browser. The catalog reads live in the server module.
 */
export const readLegalPageFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LegalPageInput))
  .handler(async ({ data }) => {
    const { readLegalPageHandler } = await import(
      "@/lib/content/page/read.server"
    );
    return readLegalPageHandler({ data });
  });

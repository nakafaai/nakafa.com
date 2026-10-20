import { LocaleSchema } from "@repo/internationalization/src/locale";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Schema } from "effect";

/** The absolute privacy and terms addresses of the sign-in sentence. */
const AuthLegalLinksSchema = Schema.Struct({
  privacy: Schema.String,
  terms: Schema.String,
});

export type AuthLegalLinks = typeof AuthLegalLinksSchema.Type;

/**
 * Reads the privacy and terms addresses of one locale on the server. A school
 * host names no locale, so the server negotiates it from the request, as the
 * school frame does.
 */
export const readAuthLegalFn = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ locale: Schema.optionalKey(LocaleSchema) })
    )
  )
  .handler(async ({ data }) => {
    const { readAuthLegalLinks } = await import("@/lib/auth/legal.server");
    return readAuthLegalLinks(
      data.locale ?? negotiateLocale(getRequestHeaders())
    );
  });

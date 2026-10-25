import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Option, Schema } from "effect";

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
    const [{ readAuthLegalHandler }, { runServerEffect }] = await Promise.all([
      import("@/lib/auth/legal.server"),
      import("@/lib/server/fn"),
    ]);
    // The null exists only at this serialization boundary.
    return runServerEffect(
      readAuthLegalHandler(data.locale).pipe(Effect.map(Option.getOrNull))
    );
  });

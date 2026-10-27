import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Option, Schema } from "effect";

/** Reads the privacy and terms addresses of one locale on the server. */
export const readAuthLegalFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ locale: LocaleSchema })))
  .handler(async ({ data }) => {
    const [{ readAuthLegalLinks }, { runServerEffect }] = await Promise.all([
      import("@/lib/auth/legal.server"),
      import("@/lib/server/fn"),
    ]);
    // The null exists only at this serialization boundary.
    return runServerEffect(
      readAuthLegalLinks(data.locale).pipe(Effect.map(Option.getOrNull))
    );
  });

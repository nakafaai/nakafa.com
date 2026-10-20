import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The locale of the site shell navigation, decoded at the server boundary. */
const MarketingShellInput = Schema.Struct({ locale: LocaleSchema });

/**
 * Reads the site shell navigation of one locale on the server, so the route's
 * loader never imports the server-only navigation reads.
 */
export const readMarketingShellFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(MarketingShellInput))
  .handler(async ({ data }) => {
    const { readMarketingShell } = await import("@/lib/marketing/shell.server");
    return readMarketingShell(data.locale);
  });

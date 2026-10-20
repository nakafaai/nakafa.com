import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** The locale path of a visitor who opens the site root, from the locale cookie and the language header. */
const readRootLocalePath = createServerFn({ method: "GET" }).handler(
  () => `/${negotiateLocale(getRequest().headers)}`
);

/**
 * The site root answers with a 307 to the negotiated locale. The answer depends
 * on the cookie and the language header, so the response says so with `Vary`,
 * as the locale decision of `@repo/internationalization/src/redirect` does.
 */
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    throw redirect({
      href: await readRootLocalePath(),
      headers: { Vary: "Accept-Language, Cookie" },
      statusCode: 307,
    });
  },
});

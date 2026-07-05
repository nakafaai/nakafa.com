import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { LLMS_CACHE_CONTROL } from "@/lib/llms/constants";
import { getLlmsPageCatalogIndexText } from "@/lib/llms/page-catalog";

const MARKDOWN_HEADERS = {
  "Cache-Control": LLMS_CACHE_CONTROL,
  "Content-Type": "text/markdown; charset=utf-8",
  Vary: "Accept",
};

/** Serves the source-backed locale page catalog without generated public files. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/llms/[locale]/pages/llms.txt">
) {
  const { locale } = await ctx.params;

  if (!hasLocale(routing.locales, locale)) {
    return new Response("Not found", {
      headers: MARKDOWN_HEADERS,
      status: 404,
    });
  }

  const text = await Effect.runPromise(getLlmsPageCatalogIndexText(locale));

  return new Response(text, {
    headers: MARKDOWN_HEADERS,
  });
}

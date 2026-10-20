import "@fontsource-variable/inter";
import "@fontsource/amiri/arabic-400.css";
import "@fontsource/amiri/latin-400.css";
import { textDirection } from "@repo/internationalization/src/direction";
import {
  DEFAULT_LOCALE,
  decodeLocale,
} from "@repo/internationalization/src/locale";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useParams,
} from "@tanstack/react-router";
import { cn } from "cn";
import { Option } from "effect";
import { Announcer } from "@/components/navigation/announcer";
import { signedInHintScript } from "@/lib/auth/hint";
import { pricingCurrencyScript } from "@/lib/pricing/currency";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";
import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

/**
 * The document of every route. Its language and direction follow the locale
 * param of the route on screen, and the default locale answers a path without
 * one. The pre-paint scripts set the theme, the pricing currency and the
 * signed-in hint before the first frame, so nothing changes after paint.
 */
function RootDocument() {
  const params: Readonly<Record<string, string | undefined>> = useParams({
    strict: false,
  });
  const locale = Option.getOrElse(
    decodeLocale(params.locale),
    () => DEFAULT_LOCALE
  );

  return (
    <html dir={textDirection(locale)} lang={locale} suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only.
          dangerouslySetInnerHTML={{ __html: THEME_PREPAINT_SCRIPT }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only.
          dangerouslySetInnerHTML={{ __html: pricingCurrencyScript() }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only.
          dangerouslySetInnerHTML={{ __html: signedInHintScript() }}
        />
        <HeadContent />
      </head>
      <body className={cn("relative touch-manipulation font-sans antialiased")}>
        <Announcer />
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

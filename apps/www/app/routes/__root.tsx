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
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  Scripts,
  useParams,
} from "@tanstack/react-router";
import { cn } from "cn";
import { Option } from "effect";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { Announcer } from "@/components/navigation/announcer";
import {
  LocalizedError,
  LocalizedNotFound,
} from "@/components/state/localized";
import { signedInHintScript } from "@/lib/auth/hint";
import { pricingCurrencyScript } from "@/lib/pricing/currency";
import { SOCIAL_SITE_NAME } from "@/lib/seo/social";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";
import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: SOCIAL_SITE_NAME },
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        href: "/favicon.ico",
        rel: "icon",
        sizes: "16x16",
        type: "image/x-icon",
      },
      { href: "/logo.svg", rel: "icon", type: "image/svg+xml" },
      { href: "/favicon.ico", rel: "shortcut icon" },
      { href: "/logo.svg", rel: "apple-touch-icon" },
    ],
  }),
  component: RootDocument,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
});

/**
 * The document of every route. Its language and direction follow the locale
 * param of the route on screen, and the default locale answers a path without
 * one. The pre-paint scripts set the theme, the pricing currency and the
 * signed-in hint before the first frame, so nothing changes after paint. The
 * URL-state adapter is mounted here once, for every route below.
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
        <NuqsAdapter>
          <Outlet />
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  );
}

/** A path outside every locale answers the not-found state in the default locale. */
function RootNotFound() {
  return <LocalizedNotFound locale={DEFAULT_LOCALE} />;
}

/** A root failure answers the error state in the default locale, without the app's providers. */
function RootError({ error }: ErrorComponentProps) {
  return (
    <LocalizedError
      error={error}
      locale={DEFAULT_LOCALE}
      source="start-root-error"
    />
  );
}

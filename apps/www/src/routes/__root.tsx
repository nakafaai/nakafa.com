import "@fontsource-variable/inter";
import "@fontsource/amiri/arabic-400.css";
import "@fontsource/amiri/latin-400.css";
import { ThemeProvider } from "@repo/design-system/providers/theme";
import { textDirection } from "@repo/internationalization/src/direction";
import {
  DEFAULT_LOCALE,
  decodeLocale,
} from "@repo/internationalization/src/locale";
import {
  createRootRoute,
  type ErrorComponentProps,
  HeadContent,
  Scripts,
  useMatch,
  useParams,
} from "@tanstack/react-router";
import { cn } from "cn";
import { Option } from "effect";
import type { ReactNode } from "react";
import { DeferredPreviewRefresh } from "@/components/dev/deferred";
import { Announcer } from "@/components/navigation/announcer";
import {
  LocalizedError,
  LocalizedNotFound,
} from "@/components/state/localized";
import { signedInHintScript } from "@/lib/auth/hint";
import { readPreviewRefreshFn } from "@/lib/content/preview/refresh.functions";
import { pricingCurrencyScript } from "@/lib/pricing/currency";
import { readNotFoundPageLocale } from "@/lib/routing/not-found";
import { SOCIAL_SITE_NAME } from "@/lib/seo/social";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";
import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  /**
   * The local preview revision is read once per document: with an infinite stale
   * time, a client navigation keeps the loader data of the first document, so the
   * listener stays mounted and no navigation calls the server.
   */
  staleTime: Number.POSITIVE_INFINITY,
  loader: () => readPreviewRefreshFn(),
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
  shellComponent: RootDocument,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
});

/**
 * The document of every route, and of the error and not-found states, which the
 * router renders inside it. Its language and direction follow the locale param
 * of the route on screen, then the language a school page renders in, then the
 * locale of the standalone not-found page, and the default locale answers a path
 * without one. The pre-paint scripts set the theme, the pricing currency and the
 * signed-in hint before the first frame, so nothing changes after paint. The
 * theme and the URL-state adapter are mounted here once, for every route below.
 */
function RootDocument({ children }: { children: ReactNode }) {
  const params: Readonly<Record<string, string | undefined>> = useParams({
    strict: false,
  });
  const notFoundMatch = useMatch({ from: "/_not-found", shouldThrow: false });
  const preview = useMatch({
    from: "__root__",
    shouldThrow: false,
  })?.loaderData;
  const schoolMatch = useMatch({ from: "/school", shouldThrow: false });
  const locale = Option.getOrElse(
    Option.orElse(
      Option.orElse(decodeLocale(params.locale), () =>
        Option.fromNullishOr(schoolMatch?.loaderData?.locale)
      ),
      () => readNotFoundPageLocale(notFoundMatch?.error)
    ),
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
        {preview === undefined ? null : (
          <DeferredPreviewRefresh
            revision={preview.revision}
            status={preview.status}
          />
        )}
        <ThemeProvider>
          <Announcer />
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

/**
 * A path outside every locale answers the not-found state in the default locale,
 * inside the document of RootDocument.
 */
function RootNotFound() {
  return <LocalizedNotFound locale={DEFAULT_LOCALE} />;
}

/**
 * A root failure answers the error state in the default locale, without the
 * locale's providers, inside the document of RootDocument.
 */
function RootError({ error }: ErrorComponentProps) {
  return (
    <LocalizedError
      error={error}
      locale={DEFAULT_LOCALE}
      source="start-root-error"
    />
  );
}

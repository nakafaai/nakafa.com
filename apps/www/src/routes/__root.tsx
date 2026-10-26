import "@fontsource-variable/inter";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
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
  type NotFoundRouteProps,
  notFound,
  Scripts,
  useMatch,
  useParams,
} from "@tanstack/react-router";
import { cn } from "cn";
import { Option, Schema } from "effect";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { DeferredPreviewRefresh } from "@/components/dev/deferred";
import { Announcer } from "@/components/navigation/announcer";
import { ContentPageAnchorProvider } from "@/components/shared/content/anchor";
import {
  LocalizedError,
  LocalizedNotFound,
  RouteFailure,
} from "@/components/state/localized";
import { signedInHintScript } from "@/lib/auth/hint";
import { readPreviewRefreshFn } from "@/lib/content/preview/refresh.functions";
import { pricingCurrencyScript } from "@/lib/pricing/currency";
import {
  NotFoundPageData,
  readNotFoundPageLocale,
} from "@/lib/routing/not-found";
import { SOCIAL_SITE_NAME } from "@/lib/seo/social";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";
import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  /**
   * A request that the server answers not found (ADR 0026) names its not-found
   * page in the server context, so the root answers not found at the visitor's
   * own address. The browser never has that context and hydrates the root's
   * not-found match as the server sent it.
   */
  beforeLoad: ({ serverContext }) => {
    if (serverContext?.notFound !== undefined) {
      throw notFound({ data: serverContext.notFound });
    }
  },
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
      // Every page's text draws in Inter's Latin face. Found only from the
      // stylesheet, it arrived after the first paint: the text swapped from its
      // fallback in sight, and every element of the page recalculated its style.
      {
        as: "font",
        crossOrigin: "anonymous",
        href: interLatin,
        rel: "preload",
        type: "font/woff2",
      },
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
 * router renders inside it. Its language and direction follow the not-found page
 * that the server answered, then the locale param of the route on screen, then
 * the language a school page renders in, and the default locale answers a path
 * without one. The pre-paint scripts set the theme, the pricing currency and the
 * signed-in hint before the first frame, so nothing changes after paint. The
 * theme is mounted here once, for every route below.
 */
function RootDocument({ children }: { children: ReactNode }) {
  const params: Readonly<Record<string, string | undefined>> = useParams({
    strict: false,
  });
  const root = useMatch({ from: "__root__", shouldThrow: false });
  const preview = root?.loaderData;
  const schoolMatch = useMatch({ from: "/school", shouldThrow: false });
  const locale = Option.getOrElse(
    Option.orElse(
      Option.orElse(readNotFoundPageLocale(root?.error), () =>
        decodeLocale(params.locale)
      ),
      () => Option.fromNullishOr(schoolMatch?.loaderData?.locale)
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
          <MotionConfig reducedMotion="user">
            <ContentPageAnchorProvider>{children}</ContentPageAnchorProvider>
          </MotionConfig>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

/**
 * The not-found state inside the document of RootDocument: the page that the
 * server answered not found names its locale and host, and a path outside every
 * locale speaks the default locale. Search engines are asked not to index the
 * address while the state is shown.
 */
function RootNotFound({ data }: NotFoundRouteProps) {
  const page = Option.getOrElse(
    Schema.decodeUnknownOption(NotFoundPageData)(data),
    () => ({ locale: DEFAULT_LOCALE, school: false })
  );
  return (
    <>
      <meta content="noindex,nofollow" name="robots" />
      <LocalizedNotFound locale={page.locale} school={page.school} />
    </>
  );
}

/**
 * A root failure answers the error state in the default locale, without the
 * locale's providers, inside the document of RootDocument.
 */
function RootError({ error }: ErrorComponentProps) {
  return (
    <RouteFailure error={error} source="start-root-error">
      <LocalizedError locale={DEFAULT_LOCALE} />
    </RouteFailure>
  );
}

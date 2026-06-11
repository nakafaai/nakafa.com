import "@repo/design-system/styles/globals.css";
import "@repo/design-system/styles/theme.css";

import { DesignSystemProvider } from "@repo/design-system";
import { Particles } from "@repo/design-system/components/visual/particles";
import { buttonVariants } from "@repo/design-system/lib/button";
import { fonts } from "@repo/design-system/lib/fonts";
import { cn } from "@repo/design-system/lib/utils";
import en from "@repo/internationalization/dictionaries/en.json";
import id from "@repo/internationalization/dictionaries/id.json";
import { routing } from "@repo/internationalization/src/routing";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
  description: "The page you are looking for does not exist.",
};

const dictionaries = { en, id };
const NEXT_INTL_LOCALE_HEADER = "X-NEXT-INTL-LOCALE";

/** Resolves the locale that the proxy/middleware selected for this request. */
async function getNotFoundLocale() {
  const requestHeaders = await headers();
  const locale = requestHeaders.get(NEXT_INTL_LOCALE_HEADER);

  if (hasLocale(routing.locales, locale)) {
    return locale;
  }

  return routing.defaultLocale;
}

export default function GlobalNotFound() {
  const fallbackMessages = dictionaries[routing.defaultLocale].NotFound;

  return (
    <html
      className={fonts}
      lang={routing.defaultLocale}
      suppressHydrationWarning
    >
      <body>
        <DesignSystemProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <Suspense fallback={<NotFoundContent messages={fallbackMessages} />}>
            <LocalizedNotFoundContent />
          </Suspense>
        </DesignSystemProvider>
      </body>
    </html>
  );
}

/** Renders the localized not-found content after request headers are available. */
async function LocalizedNotFoundContent() {
  const locale = await getNotFoundLocale();
  const messages = dictionaries[locale].NotFound;

  return <NotFoundContent messages={messages} />;
}

/** Renders the global 404 document body from the shared locale dictionaries. */
function NotFoundContent({
  messages,
}: {
  messages: (typeof dictionaries)[keyof typeof dictionaries]["NotFound"];
}) {
  return (
    <div className="relative flex h-svh items-center justify-center">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-6 rounded-xl border bg-card/30 p-6 shadow-sm backdrop-blur-xs">
        <div className="space-y-4 text-center">
          <h1 className="font-bold font-mono text-6xl text-destructive">404</h1>

          <div className="space-y-2">
            <h2 className="font-medium text-lg tracking-tight">
              {messages.title}
            </h2>

            <p className="mx-auto max-w-md text-muted-foreground text-sm">
              {messages.description}
            </p>
          </div>

          <div className="mx-auto flex w-fit items-center gap-2">
            <a
              className={cn(buttonVariants({ variant: "secondary" }))}
              href="https://github.com/nakafaai/nakafa.com"
              rel="noopener noreferrer"
              target="_blank"
              title={messages["contribute-button"]}
            >
              {messages["contribute-button"]}
            </a>
            <Link
              className={cn(buttonVariants({ variant: "default" }))}
              href="/"
              title={messages["home-button"]}
            >
              {messages["home-button"]}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

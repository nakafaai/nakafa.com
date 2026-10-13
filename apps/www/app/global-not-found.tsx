import "@/styles/globals.css";

import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import de from "@repo/internationalization/dictionaries/standalone/de.json";
import en from "@repo/internationalization/dictionaries/standalone/en.json";
import id from "@repo/internationalization/dictionaries/standalone/id.json";
import {
  previewRouting,
  routing,
} from "@repo/internationalization/src/routing";
import { hasPreviewProvider } from "@repo/next-config/preview";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { Suspense } from "react";
import { ActionLink } from "@/components/state/action";
import { Missing } from "@/components/state/missing";
import { Stage } from "@/components/state/stage";
import { appViewport } from "@/lib/theme/viewport";

/** Global 404 viewport contract shared with localized app documents. */
export const viewport = appViewport;

/** Validates the framework-synthesized 404 route as an instant shell. */
export const instant = true;

const dictionaries = { de, en, id };
const NEXT_INTL_LOCALE_HEADER = "X-NEXT-INTL-LOCALE";

/** Generates metadata from the same locale dictionary as the 404 document. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getNotFoundLocale();
  const messages = dictionaries[locale].NotFound;

  return {
    title: messages.title,
    description: messages.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

/** Resolves the locale that the proxy/middleware selected for this request. */
async function getNotFoundLocale() {
  const requestHeaders = await headers();
  const locale = requestHeaders.get(NEXT_INTL_LOCALE_HEADER);

  if (hasLocale(routing.locales, locale)) {
    return locale;
  }

  if (hasPreviewProvider() && hasLocale(previewRouting.locales, locale)) {
    return locale;
  }

  return routing.defaultLocale;
}

/** Renders the global not-found boundary with the default locale fallback. */
export default function GlobalNotFound() {
  return (
    <Suspense fallback={<NotFoundDocument locale={routing.defaultLocale} />}>
      <LocalizedNotFoundDocument />
    </Suspense>
  );
}

/** Renders the localized not-found document after request headers are available. */
async function LocalizedNotFoundDocument() {
  return <NotFoundDocument locale={await getNotFoundLocale()} />;
}

/**
 * Renders the complete global 404 document from one locale dictionary. It is
 * its own document and has no app around it, so it reads only the small
 * dictionary of the standalone pages, with plain links, and no provider that
 * needs the app.
 */
function NotFoundDocument({ locale }: { locale: keyof typeof dictionaries }) {
  const messages = dictionaries[locale];

  return (
    <html
      className={fonts}
      data-scroll-behavior="smooth"
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <DesignSystemProvider>
          <Stage>
            <Missing
              description={messages.NotFound.description}
              scene="missing"
              title={messages.NotFound.title}
            >
              <ActionLink
                href={`/${locale}`}
                label={messages.State["home-button"]}
                variant="default"
              />
              <ActionLink
                href={`/${locale}/search`}
                label={messages.NotFound["search-button"]}
                variant="ghost"
              />
            </Missing>
          </Stage>
        </DesignSystemProvider>
      </body>
    </html>
  );
}

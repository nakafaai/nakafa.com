"use client"; // Error boundaries must be Client Components

import "@/styles/globals.css";

import { captureException } from "@repo/analytics/posthog/capture";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import de from "@repo/internationalization/dictionaries/standalone/de.json";
import en from "@repo/internationalization/dictionaries/standalone/en.json";
import id from "@repo/internationalization/dictionaries/standalone/id.json";
import { splitLocalePathname } from "@repo/internationalization/src/href";
import { routing } from "@repo/internationalization/src/routing";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const dictionaries = { de, en, id };

/** The failure screen loads when a failure reaches it, so the root's own code stays small. */
const Failure = dynamic(
  () =>
    import("@/components/state/failure.client").then(
      (module) => module.Failure
    ),
  { ssr: true }
);

/**
 * Replaces the root layout, so it renders its own document with only the
 * design system's provider: none of the app's providers and none of its
 * messages. It speaks the language of the address it was reached on, from the
 * small dictionary of the standalone pages, and falls back to the default
 * locale.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const { locale } = splitLocalePathname(usePathname(), routing.locales);
  const language = locale ?? routing.defaultLocale;
  const messages = dictionaries[language];

  useEffect(() => {
    captureException(error, {
      source: "next-global-error",
      ...(error.digest ? { nextjs_digest: error.digest } : {}),
    });
  }, [error]);

  return (
    // global-error must include html and body tags
    <html
      className={fonts}
      data-scroll-behavior="smooth"
      lang={language}
      suppressHydrationWarning
    >
      <body>
        <DesignSystemProvider>
          <Failure
            description={messages.Error.description}
            home={messages.State["home-button"]}
            homeHref={`/${language}`}
            retry={messages.Error.retry}
            title={messages.Error.title}
          />
        </DesignSystemProvider>
      </body>
    </html>
  );
}

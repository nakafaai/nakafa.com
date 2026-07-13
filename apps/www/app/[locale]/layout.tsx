import "@/styles/globals.css";

import { AnalyticsProvider } from "@repo/analytics/provider";
import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TailwindIndicator } from "@repo/design-system/components/ui/tailwind-indicator";
import { fonts } from "@repo/design-system/lib/fonts";
import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme-compatibility";
import { routing } from "@repo/internationalization/src/routing";
import { EducationalOrgJsonLd } from "@repo/seo/json-ld/educational-org";
import { WebsiteJsonLd } from "@repo/seo/json-ld/website";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

/**
 * Builds locale-scoped root metadata for every page under `[locale]`.
 *
 * Next resolves this on the server, so invalid locale segments fail through
 * `notFound()` before route children render.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations("Metadata");

  return {
    title: {
      template: `%s - ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
    applicationName: "Nakafa",
    authors: [
      {
        name: "Nabil Akbarazzima Fatih",
        url: "https://x.com/NabilFatih_",
      },
    ],
    creator: "Nabil Akbarazzima Fatih",
    publisher: "PT. Nakafa Tekno Kreatif",
    referrer: "origin-when-cross-origin",
    metadataBase: new URL("https://nakafa.com"),
    classification: t("classification"),
    generator: "Next.js",
    alternates: {
      canonical: `/${locale}`,
      languages: {
        id: "https://nakafa.com/id",
        en: "https://nakafa.com/en",
        "x-default": "https://nakafa.com/en",
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "16x16", type: "image/x-icon" },
        { url: "/logo.svg", type: "image/svg+xml" },
        new URL("/favicon.ico", "https://nakafa.com"),
      ],
      shortcut: [
        { url: "/favicon.ico" },
        new URL("/favicon.ico", "https://nakafa.com"),
      ],
      apple: [{ url: "/logo.svg" }, new URL("/logo.svg", "https://nakafa.com")],
      other: [
        { rel: "manifest", url: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", url: "/logo.svg" },
      ],
    },
    manifest: "https://nakafa.com/manifest.webmanifest",
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: false,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    category: "education",
    keywords: t("keywords")
      .split(",")
      .map((keyword) => keyword.trim()),
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: "/og.png",
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
      creator: "@nabilfatih_",
      site: "@nabilfatih_",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("title"),
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: "https://nakafa.com",
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [
        {
          url: "/og.png",
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

/** Root viewport contract shared by every localized app route. */
export const viewport: Viewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: THEME_COMPATIBILITY_COLORS.light.background,
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: THEME_COMPATIBILITY_COLORS.dark.background,
    },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

/** Prebuilds one root layout shell per configured next-intl locale. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Provides the locale-scoped application shell, validates the active locale at
 * the Next boundary, and wires providers shared by every public route.
 */
export default async function Layout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html className={fonts} lang={locale} suppressHydrationWarning>
      <body className="relative">
        <p className="sr-only">
          For AI agents: use <Link href="/llms.txt">/llms.txt</Link> for the
          Nakafa content index.
        </p>
        <EducationalOrgJsonLd />
        <WebsiteJsonLd locale={locale} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AnalyticsProvider>
            <DesignSystemProvider>
              <div className="isolate">{children}</div>
              <Toaster />
            </DesignSystemProvider>
          </AnalyticsProvider>
          <TailwindIndicator />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

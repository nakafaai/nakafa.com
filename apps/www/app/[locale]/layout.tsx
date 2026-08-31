import "@/styles/globals.css";

import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TailwindIndicator } from "@repo/design-system/components/ui/tailwind-indicator";
import { fonts } from "@repo/design-system/lib/fonts";
import { routing } from "@repo/internationalization/src/routing";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { EducationalOrgJsonLd } from "@repo/seo/json-ld/educational-org";
import { WebsiteJsonLd } from "@repo/seo/json-ld/website";
import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { PreviewRefresh } from "@/components/dev/preview-refresh";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readPreviewStaticLocaleParams } from "@/lib/content/preview/route";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { appViewport } from "@/lib/theme/viewport";

/**
 * Builds locale-scoped root metadata for every page under `[locale]`.
 *
 * Next resolves this on the server, so invalid locale segments fail through
 * `notFound()` before route children render.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocaleOrThrow(await getLocale());

  const t = await getTranslations("Metadata");

  return {
    title: {
      template: `%s - ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
    applicationName: COMPANY_IDENTITY.brandName,
    authors: [
      {
        name: "Nabil Akbarazzima Fatih",
        url: "https://x.com/NabilFatih_",
      },
    ],
    creator: "Nabil Akbarazzima Fatih",
    publisher: COMPANY_IDENTITY.legalName,
    referrer: "origin-when-cross-origin",
    metadataBase: new URL(COMPANY_IDENTITY.url),
    classification: t("classification"),
    generator: "Next.js",
    alternates: createLocalizedAlternates(`/${locale}`),
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "16x16", type: "image/x-icon" },
        { url: "/logo.svg", type: "image/svg+xml" },
        new URL("/favicon.ico", COMPANY_IDENTITY.url),
      ],
      shortcut: [
        { url: "/favicon.ico" },
        new URL("/favicon.ico", COMPANY_IDENTITY.url),
      ],
      apple: [{ url: "/logo.svg" }, new URL("/logo.svg", COMPANY_IDENTITY.url)],
      other: [
        { rel: "manifest", url: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", url: "/logo.svg" },
      ],
    },
    manifest: new URL("/manifest.webmanifest", COMPANY_IDENTITY.url).href,
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
      url: COMPANY_IDENTITY.url,
      siteName: COMPANY_IDENTITY.brandName,
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
export const viewport = appViewport;

/** Prebuilds active shells or the single selected local preview shell. */
export async function generateStaticParams() {
  if (hasPreviewConfig()) {
    return await readPreviewStaticLocaleParams();
  }

  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Provides the locale-scoped application shell, validates the active locale at
 * the Next boundary, and wires providers shared by every public route.
 */
export default async function Layout({ children }: LayoutProps<"/[locale]">) {
  const locale = getLocaleOrThrow(await getLocale());

  const messages = await getMessages();

  return (
    <html
      className={fonts}
      data-scroll-behavior="smooth"
      lang={locale}
      suppressHydrationWarning
    >
      <body className="relative">
        {hasPreviewConfig() ? <PreviewRefresh /> : null}
        <p className="sr-only">
          For AI agents: use <Link href="/llms.txt">/llms.txt</Link> for the
          Nakafa content index.
        </p>
        <EducationalOrgJsonLd />
        <WebsiteJsonLd locale={locale} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DesignSystemProvider>
            <div className="isolate">{children}</div>
            <Toaster />
          </DesignSystemProvider>
          <TailwindIndicator />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale, type Locale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/styles/globals.css";

import { VercelAnalytics } from "@repo/analytics/vercel";
import { ReactScan } from "@repo/design-system/components/ui/react-scan";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TailwindIndicator } from "@repo/design-system/components/ui/tailwind-indicator";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Math.Metadata");

  const url = "https://math.nakafa.com";

  return {
    title: {
      template: `%s - ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
    applicationName: t("title"),
    authors: [
      {
        name: "Nabil Akbarazzima Fatih",
        url: "https://x.com/NabilFatih_",
      },
    ],
    creator: "Nabil Akbarazzima Fatih",
    publisher: "PT. Nakafa Tekno Kreatif",
    referrer: "origin-when-cross-origin",
    metadataBase: new URL(url),
    generator: "Next.js",
    alternates: {
      canonical: url,
      languages: {
        id: `${url}/id`,
        en: `${url}/en`,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "16x16", type: "image/x-icon" },
        { url: "/logo.svg", type: "image/svg+xml" },
        new URL("/favicon.ico", url),
      ],
      shortcut: [{ url: "/favicon.ico" }, new URL("/favicon.ico", url)],
      apple: [{ url: "/logo.svg" }, new URL("/logo.svg", url)],
      other: [
        { rel: "manifest", url: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", url: "/logo.svg" },
      ],
    },
    manifest: `${url}/manifest.webmanifest`,
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
    category: "finance",
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
      url,
      siteName: t("title"),
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <html className={fonts} lang={locale} suppressHydrationWarning>
      <NextIntlClientProvider>
        <head>
          <ReactScan />
        </head>
        <body>
          <DesignSystemProvider>
            <div className="relative">{children}</div>
            <Toaster />
          </DesignSystemProvider>

          <VercelAnalytics />
          <TailwindIndicator />
        </body>
      </NextIntlClientProvider>
    </html>
  );
}

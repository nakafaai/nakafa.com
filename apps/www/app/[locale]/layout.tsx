import { DesignSystemProvider } from "@repo/design-system";
import { cn } from "@repo/design-system/lib/utils";
import { routing } from "@repo/internationalization/src/routing";

import { type Locale, NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";

import "@repo/design-system/styles/globals.css";
import "@repo/design-system/styles/theme.css";
import "katex/dist/katex.min.css";

import { AppProviders } from "@/components/providers";
import { SearchCommand } from "@/components/shared/search-command";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Header } from "@/components/sidebar/header";
import { VercelAnalytics } from "@repo/analytics/vercel";
import { ReactScan } from "@repo/design-system/components/ui/react-scan";
import {
  SidebarInset,
  SidebarProvider,
} from "@repo/design-system/components/ui/sidebar";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TailwindIndicator } from "@repo/design-system/components/ui/tailwind-indicator";
import { EducationalOrgJsonLd } from "@repo/seo/json-ld/educational-org";
import { OrganizationJsonLd } from "@repo/seo/json-ld/organization";
import { WebsiteJsonLd } from "@repo/seo/json-ld/website";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: { params: Props["params"] }): Promise<Metadata> {
  const { locale } = await params;
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
      canonical: "https://nakafa.com",
      languages: {
        id: "https://nakafa.com/id",
        en: "https://nakafa.com/en",
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
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: "https://nakafa.com",
      siteName: "Nakafa",
      locale: locale,
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
    <html
      lang={locale}
      className={cn(
        "font-sans antialiased",
        geistSans.variable,
        geistMono.variable
      )}
      suppressHydrationWarning
    >
      <NextIntlClientProvider>
        <head>
          <ReactScan />
          {/* Add JSON-LD structured data using the JsonLd component */}
          <EducationalOrgJsonLd />
          <OrganizationJsonLd />
          <WebsiteJsonLd locale={locale} />
        </head>
        <body>
          <AppProviders>
            <DesignSystemProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <Header />
                  <SearchCommand />
                  <div data-pagefind-body className="relative">
                    {children}
                  </div>
                </SidebarInset>
              </SidebarProvider>
              <Toaster />
            </DesignSystemProvider>
          </AppProviders>

          <VercelAnalytics />
          <TailwindIndicator />
        </body>
      </NextIntlClientProvider>
    </html>
  );
}

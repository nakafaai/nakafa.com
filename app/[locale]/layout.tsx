import { ThemeProvider } from "@/components/theme/provider";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { type Locale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import "@/styles/globals.css";
import "@/styles/theme.css";
import "katex/dist/katex.min.css";

import { AppProviders } from "@/components/providers";
import { SearchCommand } from "@/components/shared/search-command";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Header } from "@/components/sidebar/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TailwindIndicator } from "@/components/ui/tailwind-indicator";
import { themes } from "@/lib/data/theme";
import type { Metadata } from "next";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({
  params,
}: { params: Props["params"] }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: {
      template: "%s - Nakafa",
      default: t("title"),
    },
    description: t("description"),
    applicationName: "Nakafa",
    authors: [
      {
        name: "Nabil Akbarazzima Fatih",
      },
    ],
    creator: "Nabil Akbarazzima Fatih",
    publisher: "PT. Nakafa Tekno Kreatif",
    referrer: "origin-when-cross-origin",
    metadataBase: new URL("https://nakafa.com"),
    alternates: {
      canonical: "https://nakafa.com",
      languages: {
        id: "https://nakafa.com/id",
        en: "https://nakafa.com/en",
      },
    },
    icons: {
      icon: [{ url: "/logo.svg" }, new URL("/logo.svg", "https://nakafa.com")],
      shortcut: [
        { url: "/logo.svg" },
        new URL("/logo.svg", "https://nakafa.com"),
      ],
      apple: [{ url: "/logo.svg" }, new URL("/logo.svg", "https://nakafa.com")],
      other: [
        { rel: "manifest", url: "/manifest.json" },
        { rel: "apple-touch-icon", url: "/logo.svg" },
      ],
    },
    manifest: "https://nakafa.com/manifest.json",
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
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: "https://nakafa.com/twitter-large.png",
          alt: t("title"),
          width: 4096,
          height: 4096,
        },
        {
          url: "https://nakafa.com/twitter-small.png",
          alt: t("title"),
          width: 1200,
          height: 675,
        },
      ],
      creator: "@nabilfatih_",
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
          url: "https://nakafa.com/facebook.png",
          alt: t("title"),
          width: 1200,
          height: 630,
        },
        {
          url: "https://nakafa.com/linkedin.png",
          alt: t("title"),
          width: 1200,
          height: 627,
        },
        {
          url: "https://nakafa.com/pinterest.png",
          alt: t("title"),
          width: 1000,
          height: 1500,
        },
        {
          url: "https://nakafa.com/reddit.png",
          alt: t("title"),
          width: 1200,
          height: 1200,
        },
        {
          url: "https://nakafa.com/twitter-large.png",
          alt: t("title"),
          width: 4096,
          height: 4096,
        },
        {
          url: "https://nakafa.com/twitter-small.png",
          alt: t("title"),
          width: 1200,
          height: 675,
        },
        {
          url: "https://nakafa.com/whatsapp.png",
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={cn(
        "font-sans antialiased",
        GeistSans.variable,
        GeistMono.variable
      )}
      suppressHydrationWarning
    >
      <body>
        <AppProviders>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            themes={themes.map((t) => t.value)}
          >
            <NextIntlClientProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <Header />
                  <SearchCommand />
                  <div data-pagefind-body>{children}</div>
                </SidebarInset>
              </SidebarProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </AppProviders>
        <Analytics />
        <SpeedInsights />
        <TailwindIndicator />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NotFound from "../not-found";

/** Generates localized noindex metadata for proxy 404 rewrites. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");

  return {
    title: t("title"),
    description: t("description"),
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

/** Renders the localized styled not-found UI for proxy 404 rewrites. */
export default function LocalizedProxyNotFoundPage() {
  return <NotFound />;
}

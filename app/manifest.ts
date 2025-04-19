import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Pick a locale that is representative of the app
  const locale = "id";

  const t = await getTranslations({
    namespace: "Metadata",
    locale,
  });

  return {
    name: t("title"),
    short_name: "Nakafa",
    description: t("description"),
    start_url: "/",
    theme_color: "#f5f5f5",
    background_color: "#f5f5f5",
    display: "standalone",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

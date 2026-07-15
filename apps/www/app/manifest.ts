import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Pick a locale that is representative of the app
  const locale = "en";

  const t = await getTranslations({
    namespace: "Metadata",
    locale,
  });

  return {
    name: "Nakafa",
    short_name: "Nakafa",
    description: t("description"),
    start_url: "/",
    theme_color: THEME_COMPATIBILITY_COLORS.light.background,
    background_color: THEME_COMPATIBILITY_COLORS.light.background,
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

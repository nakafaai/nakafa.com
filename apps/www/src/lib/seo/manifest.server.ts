import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { Effect } from "effect";
import { readCopy } from "@/lib/i18n/copy.server";

/** The manifest describes the app in English, the locale the install prompt shows. */
const MANIFEST_LOCALE = "en";

/** Serves the web app manifest that lets visitors install Nakafa. */
export const serveManifest = Effect.fn("www.seo.manifest")(function* () {
  const t = yield* readCopy({ locale: MANIFEST_LOCALE, namespace: "Metadata" });

  return Response.json(
    {
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
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
});

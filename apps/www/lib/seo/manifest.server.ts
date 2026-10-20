import "@tanstack/react-start/server-only";

import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect } from "effect";

/** The manifest describes the app in English, the locale the install prompt shows. */
const MANIFEST_LOCALE = "en";

/** Serves the web app manifest that lets visitors install Nakafa. */
export function serveManifest() {
  return Effect.runPromise(
    Effect.gen(function* () {
      const t = yield* Effect.promise(() =>
        readServerTranslator({
          locale: MANIFEST_LOCALE,
          namespace: "Metadata",
        })
      );

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
    })
  );
}

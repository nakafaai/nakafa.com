import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Schema } from "effect";

/** The manifest describes the app in English, the locale the install prompt shows. */
const MANIFEST_LOCALE = "en";

/** The copy of the manifest could not load from the translator. */
class ManifestCopyUnavailableError extends Schema.TaggedError<ManifestCopyUnavailableError>()(
  "ManifestCopyUnavailableError",
  { cause: Schema.Unknown }
) {}

/** Serves the web app manifest that lets visitors install Nakafa. */
export const serveManifest = Effect.fn("www.seo.manifest")(function* () {
  const t = yield* Effect.tryPromise({
    try: () =>
      readServerTranslator({
        locale: MANIFEST_LOCALE,
        namespace: "Metadata",
      }),
    catch: (cause) => new ManifestCopyUnavailableError({ cause }),
  });

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

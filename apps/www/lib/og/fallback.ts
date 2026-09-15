import { Effect } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { generateOGImage } from "@/lib/og";

/** Generates the brand fallback image for unknown slugs.
 *
 * Unknown social-image URLs answer 404 with brand artwork instead of
 * rendering the application shell, whose client modules cannot resolve in
 * an image route. */
export function generateFallbackImage(locale: Locale) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const t = yield* Effect.tryPromise(() =>
        getTranslations({ locale, namespace: "NotFound" })
      );
      const response = yield* Effect.tryPromise(() =>
        generateOGImage({
          description: t("description"),
          title: t("title"),
        })
      );
      const body = yield* Effect.promise(() => response.arrayBuffer());
      return new Response(body, {
        headers: response.headers,
        status: 404,
      });
    })
  );
}

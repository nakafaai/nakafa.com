import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { ImageResponse } from "takumi-js/response";
import { OgImage, type OgImageProps } from "@/lib/og/image";

const ogLogoStyle = {
  width: 48,
  height: 48,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  borderRadius: "50%",
} satisfies CSSProperties;

type GenerateOGImageOptions = OgImageProps & {
  height?: number;
  width?: number;
};

/** Loads the shared logo asset as a serializable data URL for OG rendering. */
async function getLogoDataUrl() {
  "use cache";

  cacheLife("max");

  return await Effect.runPromise(
    Effect.tryPromise(() =>
      readFile(join(process.cwd(), "public", "logo.svg"), "utf8")
    ).pipe(
      Effect.map(
        (logo) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo)}`
      )
    )
  );
}

/** Generates one OG image response with cached persistent assets. */
export function generateOGImage(options: GenerateOGImageOptions) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const { height = 630, icon, width = 1200, ...imageProps } = options;
      const logoDataUrl = yield* Effect.tryPromise(getLogoDataUrl);

      return new ImageResponse(
        <OgImage
          {...imageProps}
          icon={
            icon ?? (
              <div
                style={{
                  ...ogLogoStyle,
                  backgroundImage: `url(${logoDataUrl})`,
                }}
              />
            )
          }
        />,
        {
          width,
          height,
        }
      );
    })
  );
}

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

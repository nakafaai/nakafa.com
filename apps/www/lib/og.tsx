import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { cacheLife } from "next/cache";
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
    Effect.tryPromise({
      try: () => readFile(join(process.cwd(), "public", "logo.svg"), "utf8"),
      catch: (error) => error,
    }).pipe(
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
      const logoDataUrl = yield* Effect.tryPromise({
        try: getLogoDataUrl,
        catch: (error) => error,
      });

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

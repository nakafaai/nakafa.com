import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, Schema } from "effect";
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

const OgImageSizeSchema = Schema.Struct({
  height: Schema.optionalKey(Schema.Finite),
  width: Schema.optionalKey(Schema.Finite),
});

type GenerateOGImageOptions = OgImageProps & typeof OgImageSizeSchema.Type;

/** Loads the shared logo asset as a serializable data URL for OG rendering. */
async function getLogoDataUrl() {
  "use cache";

  cacheLife("max");

  return await Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const logo = yield* fs.readFileString(
        path.join(process.cwd(), "public", "logo.svg")
      );
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo)}`;
    }).pipe(Effect.provide(Layer.merge(NodeFileSystem.layer, NodePath.layer)))
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

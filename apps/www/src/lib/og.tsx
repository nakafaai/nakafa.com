import { Schema } from "effect";
import type { CSSProperties } from "react";
import { ImageResponse } from "takumi-js/response";
import { OG_IMAGE_HEADERS } from "@/lib/og/headers";
import { OgImage, type OgImageProps } from "@/lib/og/image";
import logoSvg from "../../public/logo.svg?raw";

const ogLogoStyle = {
  width: 48,
  height: 48,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  borderRadius: "50%",
} satisfies CSSProperties;

const OgImageResponseSchema = Schema.Struct({
  headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  height: Schema.optionalKey(Schema.Finite),
  width: Schema.optionalKey(Schema.Finite),
});

type GenerateOGImageOptions = OgImageProps & typeof OgImageResponseSchema.Type;

/**
 * The shared logo, bundled with the server code as a data URL. The image route
 * never reads the file system, so the logo needs no deployment tracing.
 */
const LOGO_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`;

/**
 * Generates one OG image response. The response carries the CDN headers of a
 * known route unless the caller names others.
 */
export function generateOGImage(options: GenerateOGImageOptions) {
  const {
    headers = OG_IMAGE_HEADERS,
    height = 630,
    icon,
    width = 1200,
    ...imageProps
  } = options;

  return new ImageResponse(
    <OgImage
      {...imageProps}
      icon={
        icon ?? (
          <div
            style={{
              ...ogLogoStyle,
              backgroundImage: `url(${LOGO_DATA_URL})`,
            }}
          />
        )
      }
    />,
    {
      headers,
      width,
      height,
    }
  );
}

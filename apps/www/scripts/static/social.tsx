import type { CSSProperties } from "react";
import { ImageResponse } from "takumi-js/response";
import { OgImage } from "@/lib/og/image";

const SOCIAL_IMAGE_WIDTH = 1200;
const SOCIAL_IMAGE_HEIGHT = 630;

const logoStyle = {
  width: 48,
  height: 48,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  borderRadius: "50%",
} satisfies CSSProperties;

/** The shared logo as a data URL, the same text the runtime image carried. */
function logoDataUrl(logoSvg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`;
}

/**
 * Renders one social image as PNG bytes with the native takumi of Node. The
 * element is the one the image route rendered, so the bytes match its answer.
 */
export async function renderSocialImage({
  description,
  logoSvg,
  title,
}: {
  readonly description: string;
  readonly logoSvg: string;
  readonly title: string;
}): Promise<Uint8Array> {
  const response = new ImageResponse(
    <OgImage
      description={description}
      icon={
        <div
          style={{
            ...logoStyle,
            backgroundImage: `url(${logoDataUrl(logoSvg)})`,
          }}
        />
      }
      title={title}
    />,
    { height: SOCIAL_IMAGE_HEIGHT, width: SOCIAL_IMAGE_WIDTH }
  );
  return new Uint8Array(await response.arrayBuffer());
}

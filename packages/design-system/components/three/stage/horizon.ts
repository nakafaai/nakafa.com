import { Color, DataUtils, LinearSRGBColorSpace } from "three";

/** How far above and below the horizon the rows that set the haze reach, in degrees. */
const HORIZON_BAND = 8;

/**
 * Reads the tone a backdrop shows at its horizon: the mean linear color of the
 * rows within eight degrees of it, scaled by the backdrop's exposure. Distant
 * ground fades into this tone, so it meets the backdrop whatever the photo.
 *
 * @param data - An equirectangular image of half floats, four channels per
 * pixel, as three decodes an EXR
 * @param width - The image's width in pixels
 * @param height - The image's height in pixels
 * @param exposure - The intensity the backdrop is drawn at
 */
export function horizonColor(
  data: Uint16Array,
  width: number,
  height: number,
  exposure: number
) {
  const band = Math.max(1, Math.round((height * HORIZON_BAND) / 180));
  const first = Math.floor(height / 2) - band;
  const last = Math.ceil(height / 2) + band;
  let red = 0;
  let green = 0;
  let blue = 0;
  let index = 0;
  for (const value of data.subarray(first * width * 4, last * width * 4)) {
    const channel = index % 4;
    index += 1;
    if (channel === 0) {
      red += DataUtils.fromHalfFloat(value);
    } else if (channel === 1) {
      green += DataUtils.fromHalfFloat(value);
    } else if (channel === 2) {
      blue += DataUtils.fromHalfFloat(value);
    }
  }
  const scale = exposure / ((last - first) * width);

  return new Color().setRGB(
    red * scale,
    green * scale,
    blue * scale,
    LinearSRGBColorSpace
  );
}

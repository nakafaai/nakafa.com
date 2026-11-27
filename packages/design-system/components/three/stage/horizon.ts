import { Color, DataUtils, LinearSRGBColorSpace } from "three";

/** Between which heights above the horizon the rows that set the haze lie, in degrees. */
const HAZE_LOW = 8;
const HAZE_HIGH = 24;

/**
 * Reads the tone of a backdrop's sky just above its horizon: the mean linear
 * color of the rows from eight to twenty-four degrees above it, over the
 * tree lines and roofs that stand on the horizon itself, scaled by the
 * backdrop's exposure. Distant ground fades into this tone, as ground does
 * into the haze under a real sky, so it meets the backdrop whatever the
 * photo. The rows of the image run from the ground up.
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
  const middle = Math.floor(height / 2);
  const first = middle + Math.round((height * HAZE_LOW) / 180);
  const last = Math.max(
    first + 1,
    middle + Math.round((height * HAZE_HIGH) / 180)
  );
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

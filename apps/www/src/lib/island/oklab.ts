/**
 * Colors blended in OKLab (ADR 0047, D43), a space where equal steps look
 * equally far apart: a blend from day to dusk passes through the warm colors
 * between them instead of a muddy grey, and a grey keeps its lightness.
 */

/** A color as red, green and blue from 0 to 1, as the screen shows it (sRGB). */
export type Rgb = readonly [number, number, number];

/** A color's lightness, then how green to red and blue to yellow it is. */
type Lab = readonly [number, number, number];

/** One sRGB channel as the light it stands for. */
function linearOf(channel: number) {
  return channel <= 0.040_45
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** One channel of light as the sRGB value that shows it, kept from 0 to 1. */
function encodedOf(channel: number) {
  const light = Math.min(1, Math.max(0, channel));
  return light <= 0.003_130_8
    ? light * 12.92
    : 1.055 * light ** (1 / 2.4) - 0.055;
}

/** A screen color in OKLab. */
export function labOf(color: Rgb): Lab {
  const [red, green, blue] = [
    linearOf(color[0]),
    linearOf(color[1]),
    linearOf(color[2]),
  ];
  const l = Math.cbrt(
    0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue
  );
  const m = Math.cbrt(
    0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue
  );
  const s = Math.cbrt(
    0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue
  );
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ];
}

/** An OKLab color on the screen, each channel kept from 0 to 1. */
export function rgbOfLab(lab: Lab): Rgb {
  const l = (lab[0] + 0.396_337_777_4 * lab[1] + 0.215_803_757_3 * lab[2]) ** 3;
  const m = (lab[0] - 0.105_561_345_8 * lab[1] - 0.063_854_172_8 * lab[2]) ** 3;
  const s = (lab[0] - 0.089_484_177_5 * lab[1] - 1.291_485_548 * lab[2]) ** 3;
  return [
    encodedOf(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s),
    encodedOf(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s),
    encodedOf(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s),
  ];
}

/** The color `t` of the way from `from` to `to`, blended in OKLab. */
export function blendLab(from: Rgb, to: Rgb, t: number): Rgb {
  const a = labOf(from);
  const b = labOf(to);
  return rgbOfLab([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]);
}

/** A color with `t` of its colorfulness taken away and its lightness kept. */
export function greyedLab(color: Rgb, t: number): Rgb {
  const [lightness, a, b] = labOf(color);
  return rgbOfLab([lightness, a * (1 - t), b * (1 - t)]);
}

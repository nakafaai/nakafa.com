import { Array as Arr, Schema } from "effect";

/** The grounds that an animal can stand on, as six hexadecimal digits. */
export const GROUNDS = [
  "b9624b",
  "2f7b6e",
  "6d4b78",
  "243e66",
  "707a52",
  "b88a33",
  "56708c",
  "2e5b45",
  "b45c6e",
  "4b4fb0",
  "8e9ad6",
  "5e8f9c",
  "8c5a8f",
  "3f6fa0",
  "7c9a6e",
  "c7788a",
  "f4e6ce",
  "cfe6f7",
  "f7d774",
  "f4c7cf",
  "ddebb5",
  "dcd3f4",
];

/** A ground: six lower-case hexadecimal digits, without the `#`. */
export const Ground = Schema.String.check(Schema.isPattern(/^[0-9a-f]{6}$/u));

/** How much brighter or darker than its ground an animal's body must be. */
const STANDS_OUT = 2.4;

/** The relative luminance of a colour, from `#rrggbb` or `rrggbb`. */
function luminance(color: string) {
  const digits = color.replace("#", "");
  const channel = (start: number) => {
    const value = Number.parseInt(digits.slice(start, start + 2), 16) / 255;
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** The contrast ratio between two colours, from 1 up to 21. */
export function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The grounds that a body colour stands out from. */
export function groundsFor(body: string) {
  return Arr.filter(GROUNDS, (ground) => contrast(body, ground) >= STANDS_OUT);
}

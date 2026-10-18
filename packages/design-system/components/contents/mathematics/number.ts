/** How the math cards write a number: at most two decimal places and no grouping. */
export const MATH_NUMBER_OPTIONS = {
  maximumFractionDigits: 2,
  useGrouping: false,
} satisfies Intl.NumberFormatOptions;

/** Writes a formatted number inside math, where a decimal comma becomes "{,}" so KaTeX keeps its spacing. */
export function mathNumber(formatted: string) {
  return formatted.replaceAll(",", "{,}");
}

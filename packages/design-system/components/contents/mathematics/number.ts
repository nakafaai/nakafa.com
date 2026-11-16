/** Writes a formatted number inside math, where a decimal comma becomes "{,}" so KaTeX keeps its spacing. */
export function mathNumber(formatted: string) {
  return formatted.replaceAll(",", "{,}");
}

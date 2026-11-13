import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { useFormatter } from "use-intl";

/**
 * Writes a measured value as KaTeX in the reader's locale, with a unit:
 * "0{,}02\text{ s}" in Indonesian and German, "0.02\text{ s}" in English. It
 * shows at most `digits` decimals, never groups thousands, and never writes a
 * negative zero for a value that rounds to nothing.
 */
export function useMeasure() {
  const format = useFormatter();
  return (value: number, unit: string, digits: number) => {
    const scale = 10 ** digits;
    const rounded = Math.round(value * scale) / scale + 0;
    return `${mathNumber(
      format.number(rounded, {
        maximumFractionDigits: digits,
        useGrouping: false,
      })
    )}${unit}`;
  };
}

import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { useFormatter } from "use-intl";

/**
 * Writes a measured value as KaTeX in the reader's locale with exactly
 * `digits` decimals, so a zero the instrument measured stays written:
 * "31{,}0" in Indonesian and German, "31.0" in English.
 */
export function useFixed() {
  const format = useFormatter();
  return (value: number, unit: string, digits: number) =>
    `${mathNumber(
      format.number(value, {
        maximumFractionDigits: Math.max(digits, 0),
        minimumFractionDigits: Math.max(digits, 0),
        useGrouping: false,
      })
    )}${unit}`;
}

import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { useFormatter } from "use-intl";

/** The units the kinematics labs read out, as KaTeX. */
export const UNIT = {
  acceleration: "\\text{ m/s}^2",
  energy: "\\text{ kJ}",
  length: "\\text{ m}",
  speed: "\\text{ m/s}",
  temperature: "\\,^\\circ\\text{C}",
  time: "\\text{ s}",
} as const;

/**
 * Writes a measured value as KaTeX in the reader's locale: "45{,}4\text{ m}"
 * in Indonesian and German, "45.4\text{ m}" in English, with at most `digits`
 * decimals and no grouping.
 */
export function useQuantity() {
  const format = useFormatter();
  return (value: number, unit: string, digits = 1) =>
    `${mathNumber(
      format.number(value, {
        maximumFractionDigits: digits,
        useGrouping: false,
      })
    )}${unit}`;
}

/**
 * Writes a reading as plain text in the reader's locale with exactly
 * `digits` decimals, as an instrument's display shows it: "102,00" in
 * Indonesian and German, "102.00" in English.
 */
export function useReading() {
  const format = useFormatter();
  return (value: number, digits: number) =>
    format.number(value, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
      useGrouping: false,
    });
}

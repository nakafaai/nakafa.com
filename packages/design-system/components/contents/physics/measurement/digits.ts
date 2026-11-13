import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { useReading } from "@repo/design-system/components/contents/simulation/quantity";

/**
 * Writes a measured value as KaTeX in the reader's locale with exactly
 * `digits` decimals and its unit, so a zero the instrument measured stays
 * written: "31{,}0\text{ cm}" in Indonesian and German, "31.0\text{ cm}" in
 * English.
 */
export function useFixed() {
  const reading = useReading();
  return (value: number, unit: string, digits: number) =>
    `${mathNumber(reading(value, Math.max(digits, 0)))}${unit}`;
}

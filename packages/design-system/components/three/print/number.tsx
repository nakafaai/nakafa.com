import { useMemo } from "react";
import { useFormatter } from "use-intl";

/**
 * How a print writes a number: in the reader's locale, with exactly the
 * decimals asked for, so a scale reads `0,5` where the lesson round it
 * does. The returned function keeps its identity for as long as the locale
 * does, so a sheet built from it is built once.
 */
export function usePrintNumber() {
  const format = useFormatter();

  return useMemo(
    () => (value: number, digits: number) =>
      format.number(value, "axis", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }),
    [format]
  );
}

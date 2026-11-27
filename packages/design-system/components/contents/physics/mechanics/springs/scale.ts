import { ruleMarks } from "@repo/design-system/components/three/print/rule";

/**
 * The printed scale of a rule that hangs beside the springs, `long` from
 * its zero at the top, on which one centimetre takes `unit`: a tick at
 * every centimetre down its right edge and a number at every fifth.
 *
 * @param rule - The rule's length and width, and how long one centimetre is on it
 * @param ink - The colour of the print
 * @param format - How a number is written, in the reader's locale
 */
export function ruleSheet(
  rule: { readonly long: number; readonly unit: number; readonly wide: number },
  ink: string,
  format: (value: number, digits: number) => string
) {
  return {
    height: rule.long,
    marks: ruleMarks(
      {
        from: [rule.wide / 2, rule.long / 2],
        scale: {
          from: 0,
          major: 5,
          minor: 1,
          to: rule.long / rule.unit,
        },
        side: -1,
        to: [rule.wide / 2, -rule.long / 2],
      },
      format,
      {
        ink,
        major: rule.wide * 0.34,
        minor: rule.wide * 0.18,
        size: rule.wide * 0.26,
        width: rule.wide * 0.022,
      }
    ),
    width: rule.wide,
  };
}

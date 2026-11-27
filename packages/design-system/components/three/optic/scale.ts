import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import { Array as Arr } from "effect";

/**
 * The engraved centimetre scale of an optical bench, as prints: a short
 * tick at every centimetre, a longer one at every fifth and a numbered one
 * at every tenth, counted from the rail's left end. A rail is far longer
 * than one print stays sharp over, so the scale is cut into one sheet about
 * each numbered tick, each a decade of centimetres wide, and the last one
 * ends where the rail does.
 */

/** How many centimetres one sheet of the scale covers, with its number in the middle. */
const DECADE = 10;

/**
 * The sheets of a scale, each with the place of its middle along the rail
 * from the rail's left end. The sizes of the ticks and the numbers follow
 * the height of the band they are engraved in.
 *
 * @param measure - The scale's length and the height of its band, in scene units, and how many scene units one centimetre takes
 * @param ink - The colour of the paint in the engraving
 * @param format - How a number is written, in the reader's locale
 */
export function railSheets(
  measure: {
    readonly long: number;
    readonly tall: number;
    readonly unit: number;
  },
  ink: string,
  format: (value: number, digits: number) => string
) {
  const { long, tall, unit } = measure;
  if (!(unit > 0 && long > 0)) {
    return [];
  }
  const end = long / unit;
  const style = { ink, minor: tall * 0.2, size: 0, width: tall * 0.035 };
  const spans = Arr.map(
    Arr.range(0, Math.floor(end / DECADE + 0.5)),
    (decade) => ({
      decade,
      high: Math.min(end, decade * DECADE + DECADE / 2),
      low: Math.max(0, decade * DECADE - DECADE / 2),
    })
  );
  return Arr.map(
    Arr.filter(spans, (span) => span.high > span.low),
    ({ decade, high, low }) => {
      const width = (high - low) * unit;
      const line = {
        from: [-width / 2, tall / 2] as const,
        side: -1 as const,
        to: [width / 2, tall / 2] as const,
      };
      return {
        at: ((low + high) / 2) * unit,
        sheet: {
          height: tall,
          marks: [
            ...ruleMarks(
              {
                ...line,
                scale: { from: low, major: DECADE, minor: 1, to: high },
              },
              format,
              {
                ...style,
                major: tall * 0.42,
                size: decade === 0 ? 0 : tall * 0.38,
              }
            ),
            ...ruleMarks(
              { ...line, scale: { from: low, major: DECADE / 2, to: high } },
              format,
              { ...style, major: tall * 0.3 }
            ),
          ],
          width,
        },
      };
    }
  );
}

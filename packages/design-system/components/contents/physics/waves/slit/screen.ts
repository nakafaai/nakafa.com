import {
  fringeSpacing,
  fringesInSpan,
} from "@repo/design-system/components/contents/physics/waves/wave";
import { ruleMarks } from "@repo/design-system/components/three/print/rule";
import type { Mark } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr, Option, Schema } from "effect";

/**
 * What Young's fringes look like on the screen of the double slit lab. The
 * real fringes are a few millimetres apart, far too fine to see from across
 * a bench, so the screen shows them in close-up: its band is `SCREEN_HALF`
 * millimetres each side of the centre, with a millimetre scale printed
 * under it that says so.
 */

/** How much of the pattern the screen shows each side of its centre, in millimetres. */
export const SCREEN_HALF = 20;

/** Young's arrangement: the slit separation in millimetres, the distance to the screen in metres, and the wavelength in nanometres. */
const ArrangementSchema = Schema.Struct({
  distance: Schema.Finite,
  separation: Schema.Finite,
  wavelength: Schema.Finite,
});

/** The fringe spacing on the screen, in millimetres. */
export function spacingOf(light: typeof ArrangementSchema.Type) {
  return (
    fringeSpacing(
      light.wavelength * 1e-9,
      light.separation * 1e-3,
      light.distance
    ) * 1000
  );
}

/**
 * Where the bright fringe the count starts at stands, in millimetres from
 * the centre of the screen: the centre itself with no span, and otherwise a
 * bright fringe to its left, so the counted span lies about the centre.
 */
export function fringeStart(spacing: number, span: number | undefined) {
  return Option.match(Option.fromNullishOr(span), {
    onNone: () => 0,
    onSome: (wide) => -Math.floor(wide / spacing / 2) * spacing,
  });
}

/**
 * The marks printed on the screen, on a sheet whose band of fringes is
 * `wide` across: the millimetre scale under the band and, when a span is
 * given, a dot over every bright fringe counted in it, the span itself, and
 * the letters P and Q at its ends.
 *
 * @param fringes - The fringe spacing and the counted span, in millimetres
 * @param layout - The width of the band and the heights of the scale, the dots and the span on the sheet, in scene units
 * @param inks - The colour of the scale and of the count
 * @param format - How a number is written, in the reader's locale
 */
export function screenMarks(
  fringes: { readonly spacing: number; readonly span?: number },
  layout: {
    readonly dots: number;
    readonly scale: number;
    readonly span: number;
    readonly wide: number;
  },
  inks: { readonly count: string; readonly scale: string },
  format: (value: number, digits: number) => string
): readonly Mark[] {
  const millimetre = layout.wide / (SCREEN_HALF * 2);
  const size = layout.wide * 0.03;
  const scale = ruleMarks(
    {
      from: [-layout.wide / 2, layout.scale],
      scale: { from: -SCREEN_HALF, major: 10, minor: 1, to: SCREEN_HALF },
      side: -1,
      to: [layout.wide / 2, layout.scale],
    },
    format,
    {
      ink: inks.scale,
      major: size * 0.9,
      minor: size * 0.45,
      size,
      width: size * 0.09,
    }
  );
  return Option.match(Option.fromNullishOr(fringes.span), {
    onNone: () => scale,
    onSome: (span) => {
      const left = fringeStart(fringes.spacing, span) * millimetre;
      const right = left + span * millimetre;
      const stroke = { ink: inks.count, kind: "line", width: size * 0.12 } as const;
      return [
        ...scale,
        ...Arr.makeBy(
          fringesInSpan(span, fringes.spacing),
          (index): Mark => ({
            at: [left + index * fringes.spacing * millimetre, layout.dots],
            height: size * 0.7,
            ink: inks.count,
            kind: "band",
            radius: size * 0.35,
            width: size * 0.7,
          })
        ),
        { ...stroke, from: [left, layout.span], to: [right, layout.span] },
        ...Arr.flatMap(
          [
            { at: left, name: "P" },
            { at: right, name: "Q" },
          ],
          (end): readonly Mark[] => [
            {
              ...stroke,
              from: [end.at, layout.span - size * 0.5],
              to: [end.at, layout.span + size * 0.5],
            },
            words({
              at: [end.at, layout.span - size * 1.5],
              ink: inks.count,
              size: size * 1.2,
              text: end.name,
            }),
          ]
        ),
      ];
    },
  });
}

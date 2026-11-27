import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr, Schema } from "effect";

/**
 * A flower head of the daisy family, which is many flowers on one disc: how
 * wide the disc is, how many tiny `florets` pack it, how many strap-shaped
 * `rays` ring it, how far those have opened (0 a bud, 1 full bloom) and
 * which head it is.
 */
const HeadSchema = Schema.Struct({
  florets: Schema.Int,
  open: Schema.Finite,
  radius: Schema.Finite,
  rays: Schema.Int,
  seed: Schema.Int,
});
export type Head = typeof HeadSchema.Type;

/** The golden angle, by which each next floret turns about the middle of the disc. */
const TURN = Math.PI * (3 - Math.sqrt(5));

/** The numbers that place one strap around the rim of the disc, raised `lift` above flat. */
function strapAt(head: Head, angle: number, lift: number, size: number) {
  const out = [Math.cos(angle), Math.sin(angle)] as const;
  return [
    out[0] * head.radius * 0.92,
    0,
    out[1] * head.radius * 0.92,
    out[0] * Math.cos(lift),
    Math.sin(lift),
    out[1] * Math.cos(lift),
    -out[0] * Math.sin(lift),
    Math.cos(lift),
    -out[1] * Math.sin(lift),
    size,
  ];
}

/**
 * Every part of a flower head, with its stalk along -y, as the numbers that
 * place a leaf each: the ray florets around the rim, lying flatter the more
 * the head has opened; the green bracts behind them; and the disc florets,
 * packed along the two sets of spirals a sunflower shows, on a low dome.
 */
export function growHead(head: Head) {
  return {
    bracts: Arr.flatMap(Arr.range(0, head.rays - 1), (bract) => [
      ...strapAt(
        head,
        ((bract + 0.5) / head.rays) * 2 * Math.PI,
        -0.3 + (1 - head.open) * 1.2,
        head.radius * 1.15
      ),
      chanceAt(bract, 2, head.seed),
    ]),
    florets: Arr.flatMap(Arr.range(0, head.florets - 1), (floret) => {
      const far = Math.sqrt((floret + 0.5) / head.florets);
      const angle = floret * TURN;
      const x = Math.cos(angle) * far;
      const z = Math.sin(angle) * far;
      const lean = Math.hypot(x * 0.7, 1, z * 0.7);
      const side = Math.hypot(1, x * 0.7);
      return [
        x * head.radius,
        head.radius * 0.34 * (1 - far * far),
        z * head.radius,
        (x * 0.7) / lean,
        1 / lean,
        (z * 0.7) / lean,
        1 / side,
        (-x * 0.7) / side,
        0,
        head.radius * (0.15 - 0.05 * far),
        far,
      ];
    }),
    rays: Arr.flatMap(Arr.range(0, head.rays - 1), (ray) => {
      const chance = chanceAt(ray, 1, head.seed);
      return [
        ...strapAt(
          head,
          ((ray + 0.3 * chance) / head.rays) * 2 * Math.PI,
          0.1 + (1 - head.open) * 1.25 + 0.12 * chance,
          head.radius * (2.1 + 0.5 * chance)
        ),
        chance,
      ];
    }),
  };
}

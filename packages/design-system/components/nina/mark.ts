import { n1 } from "@repo/design-system/components/nina/body";
import { INK } from "@repo/design-system/components/nina/color";
import { path } from "@repo/design-system/components/nina/shape";

/** A round line of ink along `d`. */
export function ink(d: string, width = 5) {
  return path({
    d,
    fill: "none",
    stroke: INK,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: width,
  });
}

/** A flat four-point sparkle centred on x, y. */
export function sparkle(x: number, y: number, size: number, fill: string) {
  const k = size * 0.26;
  return path({
    d: `M${n1(x)},${n1(y - size)} Q${n1(x + k)},${n1(y - k)} ${n1(x + size)},${n1(y)} Q${n1(x + k)},${n1(y + k)} ${n1(x)},${n1(y + size)} Q${n1(x - k)},${n1(y + k)} ${n1(x - size)},${n1(y)} Q${n1(x - k)},${n1(y - k)} ${n1(x)},${n1(y - size)} Z`,
    fill,
    stroke: fill,
    strokeLinejoin: "round",
    strokeWidth: n1(size * 0.22),
  });
}

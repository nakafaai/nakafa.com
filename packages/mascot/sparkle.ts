import { path } from "@repo/mascot/shape";
import { Array as Arr, Number as Num } from "effect";

/** Rounds to one decimal, as the points of a drawing are written. */
function tenth(value: number) {
  return Num.round(value, 1);
}

/**
 * A flat four-point sparkle centred on `x`, `y`: the one ornament of the
 * product. Its edge is drawn in its own fill, which rounds the points.
 */
export function sparkle(x: number, y: number, size: number, fill: string) {
  const pinch = size * 0.26;
  const top = `${tenth(x)},${tenth(y - size)}`;
  return path({
    d: Arr.join(
      [
        `M${top}`,
        `Q${tenth(x + pinch)},${tenth(y - pinch)} ${tenth(x + size)},${tenth(y)}`,
        `Q${tenth(x + pinch)},${tenth(y + pinch)} ${tenth(x)},${tenth(y + size)}`,
        `Q${tenth(x - pinch)},${tenth(y + pinch)} ${tenth(x - size)},${tenth(y)}`,
        `Q${tenth(x - pinch)},${tenth(y - pinch)} ${top}`,
        "Z",
      ],
      " "
    ),
    fill,
    stroke: fill,
    strokeLinejoin: "round",
    strokeWidth: tenth(size * 0.22),
  });
}

import { tenth } from "@repo/mascot/round";
import { path } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

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

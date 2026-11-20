import type { Design } from "@repo/mascot/kit";
import {
  blob,
  both,
  ellipse,
  eyes,
  figure,
  grin,
  head,
  line,
  PEARL,
  PINK,
  path,
  rounded,
  shoulders,
  smile,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The pale horn of a cow or a goat. */
const HORN = "#f0d38c";

/** A ring of round curls about a centre, the wool of a sheep or an alpaca. */
function curls(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  r: number,
  fill: string,
  from = 0,
  to = 360
) {
  return Arr.makeBy(count, (index) => {
    const angle =
      ((from + ((to - from) * index) / Math.max(1, count - 1)) * Math.PI) / 180;
    return ellipse(
      cx + Math.cos(angle) * rx,
      cy + Math.sin(angle) * ry,
      r,
      r,
      fill
    );
  });
}

/** The animals of the farm and the field. */
export const farm = {
  sheep: {
    colors: [
      [PEARL, "#efd2a6"],
      ["#f4e6ce", "#c9a27e"],
    ],
    draw: (kit) =>
      figure(
        shoulders(kit.body, 66),
        curls(100, 166, 56, 18, 6, 22, kit.body, 180, 360),
        curls(100, 100, 56, 50, 12, 24, kit.body),
        ellipse(100, 100, 58, 52, kit.body),
        both((side) =>
          ellipse(100 + side * 52, 112, 22, 11, kit.second, side * -24)
        ),
        ellipse(100, 120, 36, 42, kit.second),
        curls(100, 76, 26, 8, 5, 13, kit.body, 180, 360),
        ellipse(100, 74, 26, 12, kit.body),
        eyes(kit, 18, 116, 6.4),
        smile(140, 7, 5, kit.ink)
      ),
  },
  cow: {
    colors: [
      [PEARL, "#f4c7cf"],
      ["#f4e6ce", "#f6c3a6"],
    ],
    draw: (kit) =>
      figure(
        both((side) =>
          rounded(
            `M${100 + side * 30},64 C${100 + side * 44},62 ${100 + side * 56},52 ${100 + side * 60},34 C${100 + side * 66},50 ${100 + side * 60},70 ${100 + side * 40},78 Z`,
            HORN,
            5
          )
        ),
        both((side) => [
          ellipse(100 + side * 66, 92, 24, 12, kit.body, side * -20),
          ellipse(100 + side * 66, 93, 14, 6, kit.second, side * -20),
        ]),
        shoulders(kit.body, 62),
        path(
          "M116,200 C118,184 132,174 150,176 C158,182 162,190 164,200 Z",
          kit.ink
        ),
        head(kit.body, 56, 56, 102),
        // A patch over one eye and one over the crown.
        rounded(
          "M112,74 C128,64 150,72 154,92 C156,108 146,116 132,114 C118,112 108,96 112,74 Z",
          kit.ink,
          4
        ),
        rounded("M70,52 C80,48 92,52 92,60 C90,68 78,70 70,64 Z", kit.ink, 4),
        ellipse(100, 140, 42, 28, kit.second),
        both((side) => ellipse(100 + side * 16, 136, 5, 7, kit.ink)),
        grin(152, 10, 1.8, kit.ink),
        eyes(kit, 27, 100)
      ),
  },
  pig: {
    colors: [
      ["#f4c7cf", "#ec9ab0"],
      ["#f6c3a6", "#f5a48e"],
    ],
    draw: (kit) =>
      figure(
        shoulders(kit.body, 64),
        head(kit.body, 64, 56, 106),
        // Ears that fold forward over the brow.
        both((side) =>
          rounded(
            `M${100 + side * 26},58 C${100 + side * 44},40 ${100 + side * 66},40 ${100 + side * 72},50 C${100 + side * 70},70 ${100 + side * 58},86 ${100 + side * 44},88 Z`,
            kit.second,
            6
          )
        ),
        ellipse(100, 130, 30, 22, kit.second),
        both((side) => ellipse(100 + side * 11, 130, 5, 8, kit.ink)),
        grin(155, 9, 1.8, kit.ink),
        eyes(kit, 30, 100)
      ),
  },
  horse: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#8f6a4f", "#efd2a6"],
      ["#b9c0cc", PEARL],
    ],
    draw: (kit) =>
      figure(
        both((side) =>
          blob(
            [100 + side * 22, 64, 100 + side * 40, 18, 100 + side * 50, 70],
            kit.body,
            12
          )
        ),
        shoulders(kit.body, 56),
        // The mane down the neck.
        rounded(
          "M128,64 C150,80 164,120 160,200 L136,200 C138,150 132,108 118,80 Z",
          kit.ink,
          6
        ),
        path(
          "M100,46 C132,46 150,70 150,102 C150,130 142,168 100,168 C58,168 50,130 50,102 C50,70 68,46 100,46 Z",
          kit.body
        ),
        // The forelock falling over the brow.
        rounded(
          "M82,46 C92,38 112,38 120,48 C118,64 108,74 96,78 C94,66 88,56 82,46 Z",
          kit.ink,
          6
        ),
        ellipse(100, 92, 7, 18, kit.second),
        ellipse(100, 146, 36, 24, kit.second),
        both((side) => ellipse(100 + side * 14, 142, 4, 6, kit.ink)),
        grin(156, 9, 1.6, kit.ink),
        eyes(kit, 27, 104)
      ),
  },
  goat: {
    colors: [
      [PEARL, "#c9a27e"],
      ["#c9d2dc", "#8f6a4f"],
      ["#efd2a6", "#b98a63"],
    ],
    draw: (kit) =>
      figure(
        // Ridged horns sweeping back.
        both((side) => [
          line(
            `M${100 + side * 20},68 C${100 + side * 22},40 ${100 + side * 40},22 ${100 + side * 60},28`,
            kit.second,
            14
          ),
        ]),
        // Long ears, flat out to the side.
        both((side) => [
          ellipse(100 + side * 64, 96, 28, 11, kit.body, side * -10),
          ellipse(100 + side * 64, 97, 18, 5, PINK, side * -10),
        ]),
        shoulders(kit.body, 54),
        path(
          "M100,54 C130,54 148,76 148,104 C148,132 128,166 100,166 C72,166 52,132 52,104 C52,76 70,54 100,54 Z",
          kit.body
        ),
        // The beard.
        rounded(
          "M88,160 C92,176 96,186 100,192 C104,186 108,176 112,160 Z",
          kit.second,
          6
        ),
        ellipse(100, 142, 24, 20, PEARL),
        both((side) => ellipse(100 + side * 9, 140, 3.4, 4.4, kit.ink)),
        line("M100,144 L100,152 M93,152 Q100,158 107,152", kit.ink, 3),
        eyes(kit, 26, 104)
      ),
  },
  alpaca: {
    colors: [
      ["#f4e6ce", "#c9a27e"],
      ["#c9a27e", "#f4e6ce"],
      [PEARL, "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        // Spear ears.
        both((side) => [
          blob(
            [100 + side * 24, 52, 100 + side * 36, 6, 100 + side * 48, 52],
            kit.body,
            10
          ),
          blob(
            [100 + side * 31, 46, 100 + side * 36, 22, 100 + side * 41, 46],
            kit.second,
            4
          ),
        ]),
        // The long woolly neck, narrower than the head.
        shoulders(kit.body, 46, 150),
        curls(100, 176, 40, 6, 4, 20, kit.body, 180, 360),
        curls(100, 100, 52, 48, 11, 22, kit.body),
        ellipse(100, 100, 54, 50, kit.body),
        // The topknot over the brow.
        curls(100, 62, 22, 8, 3, 18, kit.body, 180, 360),
        // The small face in the wool.
        ellipse(100, 114, 34, 38, kit.second),
        ellipse(100, 74, 22, 12, kit.body),
        ellipse(100, 134, 18, 14, PEARL),
        line("M100,128 L100,136 M93,138 Q100,143 107,138", kit.ink, 3),
        eyes(kit, 17, 110, 6)
      ),
  },
} satisfies Record<string, Design>;

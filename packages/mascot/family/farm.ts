import {
  belly,
  blob,
  both,
  type Design,
  ellipse,
  eyes,
  figure,
  head,
  line,
  nose,
  PEARL,
  path,
  smile,
  torso,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The animals of the farm: the ones that graze in a paddock or carry a load. */
export const farm = {
  sheep: {
    colors: [
      [PEARL, "#efd2a6"],
      ["#f4e6ce", "#c9a27e"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 60),
        both((side) => [
          ellipse(100 + side * 46, 150, 22, 22, kit.body),
          ellipse(100 + side * 28, 176, 24, 24, kit.body),
        ]),
        Arr.map(
          [
            [52, 96],
            [60, 68],
            [82, 50],
            [118, 50],
            [140, 68],
            [148, 96],
            [100, 44],
          ],
          ([x, y]) => ellipse(x, y, 24, 24, kit.body)
        ),
        head(kit.body, 50, 44, 100),
        both((side) =>
          ellipse(100 + side * 50, 102, 17, 9, kit.second, side * -24)
        ),
        ellipse(100, 108, 36, 38, kit.second),
        eyes(kit, 16, 102),
        nose(120, 5, 3.6, kit.ink),
        smile(126, 7, 6, kit.ink)
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
          blob(
            [100 + side * 30, 56, 100 + side * 44, 34, 100 + side * 46, 58],
            "#efd2a6",
            8
          )
        ),
        both((side) =>
          ellipse(100 + side * 64, 84, 18, 10, kit.body, side * -22)
        ),
        torso(kit.body),
        head(kit.body),
        path(
          "M118,50 C140,52 158,70 160,92 C146,96 128,90 122,74 C118,66 116,56 118,50 Z",
          kit.ink
        ),
        ellipse(100, 124, 36, 22, kit.second),
        belly(kit.second),
        eyes(kit, 28, 92),
        both((side) => ellipse(100 + side * 12, 124, 3.6, 4.6, kit.ink))
      ),
  },
  pig: {
    colors: [
      ["#f4c7cf", "#ec9ab0"],
      ["#f6c3a6", "#f5a48e"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          blob(
            [100 + side * 50, 72, 100 + side * 58, 40, 100 + side * 26, 54],
            kit.body,
            14
          ),
          blob(
            [100 + side * 46, 62, 100 + side * 50, 48, 100 + side * 36, 56],
            kit.second,
            5
          ),
        ]),
        torso(kit.body),
        head(kit.body),
        ellipse(100, 116, 25, 18, kit.second),
        both((side) => ellipse(100 + side * 9, 116, 3.6, 5.4, kit.ink)),
        eyes(kit, 28, 90),
        smile(138, 7, 5, kit.ink)
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
            [100 + side * 42, 62, 100 + side * 46, 30, 100 + side * 26, 50],
            kit.body,
            11
          )
        ),
        torso(kit.body),
        head(kit.body, 48, 56, 100),
        ellipse(100, 46, 20, 16, kit.second),
        ellipse(86, 60, 12, 16, kit.second, 24),
        ellipse(114, 60, 12, 16, kit.second, -24),
        ellipse(100, 132, 31, 22, kit.second),
        both((side) => ellipse(100 + side * 10, 132, 2.8, 3.8, kit.ink)),
        eyes(kit, 27, 96),
        line("M88,142 Q100,148 112,142", kit.ink, 3.6)
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
        both((side) =>
          line(
            `M${100 + side * 22},58 Q${100 + side * 30},28 ${100 + side * 54},24`,
            kit.second,
            10
          )
        ),
        both((side) =>
          ellipse(100 + side * 62, 92, 21, 9, kit.body, side * 16)
        ),
        torso(kit.body),
        blob([90, 146, 110, 146, 100, 172], kit.second, 8),
        head(kit.body, 52, 54, 98),
        ellipse(100, 124, 22, 17, "#f4c7cf"),
        eyes(kit, 26, 94),
        both((side) => ellipse(100 + side * 6, 120, 2.2, 3, kit.ink)),
        smile(128, 7, 5, kit.ink)
      ),
  },
  alpaca: {
    colors: [
      ["#f4e6ce", PEARL],
      ["#c9a27e", "#f4e6ce"],
      [PEARL, "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 34, 48, 10, 24, kit.body, side * 22),
          ellipse(100 + side * 34, 50, 4.6, 15, kit.second, side * 22),
        ]),
        torso(kit.body, 50),
        both((side) => [
          ellipse(100 + side * 30, 156, 24, 24, kit.body),
          ellipse(100 + side * 44, 184, 24, 24, kit.body),
        ]),
        ellipse(100, 150, 30, 56, kit.body),
        head(kit.body, 44, 46, 96),
        ellipse(100, 50, 28, 20, kit.body),
        ellipse(78, 60, 18, 16, kit.body),
        ellipse(122, 60, 18, 16, kit.body),
        ellipse(100, 114, 23, 19, kit.second),
        eyes(kit, 21, 92, 5.4),
        nose(107, 5.4, 3.8, kit.ink),
        line("M100,110 V117 M92,119 Q100,126 108,119", kit.ink, 3.6)
      ),
  },
} satisfies Record<string, Design>;

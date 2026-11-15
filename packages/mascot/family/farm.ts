import {
  belly,
  blob,
  both,
  type Design,
  ellipse,
  eyes,
  faded,
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
        // Ridged horns sweep up and back.
        both((side) => [
          line(
            `M${100 + side * 20},54 C${100 + side * 24},26 ${100 + side * 46},14 ${100 + side * 62},22`,
            kit.second,
            13
          ),
          ...Arr.map([0.3, 0.55, 0.8], (at) =>
            faded(0.22, [
              ellipse(
                100 + side * (22 + at * 32),
                46 - at * 30,
                2.2,
                7,
                kit.ink,
                side * (20 + at * 50)
              ),
            ])
          ),
        ]),
        // Leaf ears stand out sideways.
        both((side) => [
          ellipse(100 + side * 58, 84, 24, 11, kit.body, side * 16),
          ellipse(100 + side * 58, 85, 15, 5.6, "#f4c7cf", side * 16),
        ]),
        torso(kit.body, 46),
        // The beard under the chin.
        blob([88, 142, 112, 142, 100, 172], kit.second, 8),
        // A long face, narrower at the muzzle.
        path(
          "M56,84 C56,54 76,40 100,40 C124,40 144,54 144,84 C144,112 130,150 100,150 C70,150 56,112 56,84 Z",
          kit.body
        ),
        faded(0.5, [ellipse(100, 128, 24, 19, kit.second)]),
        eyes(kit, 24, 88),
        path("M92,118 L108,118 L100,127 Z", kit.ink),
        line("M100,127 L100,132 M91,131 Q100,141 109,131", kit.ink, 2.8)
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
            [100 + side * 24, 44, 100 + side * 36, 6, 100 + side * 46, 44],
            kit.body,
            10
          ),
          blob(
            [100 + side * 31, 40, 100 + side * 36, 20, 100 + side * 41, 40],
            "#f4c7cf",
            4
          ),
        ]),
        // The long woolly neck, a column of curls narrower than the head.
        Arr.flatMap([204, 180, 156, 132], (y, row) =>
          both((side) =>
            ellipse(100 + side * (20 - row * 1.5), y, 24, 20, kit.body)
          )
        ),
        // The topknot, three curls over the brow.
        ellipse(82, 44, 19, 17, kit.body),
        ellipse(118, 44, 19, 17, kit.body),
        ellipse(100, 34, 21, 19, kit.body),
        head(kit.body, 44, 42, 82),
        both((side) => ellipse(100 + side * 42, 88, 13, 18, kit.body)),
        // The small face in the wool.
        ellipse(100, 90, 32, 31, kit.second),
        faded(0.55, [ellipse(100, 90, 32, 31, PEARL)]),
        ellipse(100, 104, 19, 14, PEARL),
        eyes(kit, 17, 84, 5.6),
        path("M94,98 L106,98 L100,104 Z", kit.ink),
        line("M100,104 L100,107 M93,107 Q100,114 107,107", kit.ink, 2.6)
      ),
  },
} satisfies Record<string, Design>;

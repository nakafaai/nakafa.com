import type { Design } from "@repo/mascot/kit";
import {
  blob,
  both,
  chest,
  ellipse,
  eye,
  eyes,
  faded,
  figure,
  grin,
  INK,
  kindAt,
  line,
  PEARL,
  PINK,
  path,
  rounded,
  shoulders,
  smile,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** A forked tongue, flicking down from the middle of a mouth at `y`. */
function tongue(y: number, fill: string) {
  return rounded(
    `M95,${y} L105,${y} L105,${y + 14} L113,${y + 28} L100,${y + 20} L87,${y + 28} L95,${y + 14} Z`,
    fill,
    3
  );
}

/** The reptiles and the amphibians. */
export const reptile = {
  komodo: {
    colors: [
      ["#b4bc84", "#ec9ab0"],
      ["#9fb07a", "#f5a48e"],
    ],
    draw: (kit) =>
      figure(
        // Heavy shoulders, and the folds of the neck.
        shoulders(kit.body, 70, 146),
        faded(0.2, [
          line("M58,168 Q100,182 142,168", INK, 3.4),
          line("M50,186 Q100,200 150,186", INK, 3.4),
        ]),
        // The long flat head, tapering to the snout, under heavy brows.
        rounded(
          "M38,96 C38,68 66,56 100,56 C134,56 162,68 162,96 C162,124 132,152 118,168 C112,176 88,176 82,168 C68,152 38,124 38,96 Z",
          kit.body,
          4
        ),
        both((side) =>
          ellipse(100 + side * 38, 82, 24, 11, kit.body, side * 16)
        ),
        // Scales: a scatter of darker rounds.
        faded(0.2, [
          ...Arr.map([-18, 0, 18], (x) => ellipse(100 + x, 70, 5, 4, INK)),
          ...both((side) => [
            ellipse(100 + side * 56, 110, 5, 4, INK),
            ellipse(100 + side * 26, 120, 4.4, 3.6, INK),
            ellipse(100 + side * 52, 172, 7, 5, INK),
            ellipse(100 + side * 64, 190, 7, 5, INK),
          ]),
        ]),
        line(
          "M56,122 C74,146 90,160 100,162 C110,160 126,146 144,122",
          kit.ink,
          3.2
        ),
        both((side) => ellipse(100 + side * 8, 156, 2.6, 3.4, kit.ink)),
        tongue(170, kit.second),
        eyes(kit, 38, 96, 6.4)
      ),
  },
  crocodile: {
    colors: [
      ["#6fae6a", "#ddebb5"],
      ["#5e9c7c", "#cfebd9"],
    ],
    draw: (kit) =>
      figure(
        // Seen three quarters on, its long snout reaching to the left.
        shoulders(kit.body, 70, 150),
        chest(kit.second, 34, 178),
        // The lower jaw, then the upper jaw and the head.
        rounded(
          "M24,148 C24,158 46,168 80,170 L140,172 C150,152 150,142 140,148 Z",
          kit.second,
          6
        ),
        rounded(
          "M18,134 C18,120 30,112 50,110 L96,100 C104,72 128,62 150,68 C178,76 186,110 176,138 C170,156 152,162 130,158 L50,150 C30,150 18,144 18,134 Z",
          kit.body,
          6
        ),
        // Teeth, hanging from the upper jaw.
        Arr.map([34, 54, 74, 94, 114], (x) =>
          blob([x - 5, 148, x + 5, 149, x, 159], PEARL, 3)
        ),
        line("M22,142 C46,150 90,152 136,154", kit.ink, 3.2),
        // The nostrils on a bump at the tip, and the ridges of the back.
        ellipse(32, 114, 13, 9, kit.body),
        ellipse(32, 112, 3.4, 2.6, kit.ink),
        faded(0.2, [
          ellipse(60, 120, 5, 4, INK),
          ellipse(80, 116, 5, 4, INK),
          ellipse(160, 120, 6, 5, INK),
          ellipse(150, 140, 6, 5, INK),
        ]),
        // Two eyes, each on a bump on top of the head.
        ellipse(110, 74, 20, 18, kit.body),
        ellipse(146, 70, 20, 18, kit.body),
        eye(kindAt(kit.eyes, -1), 110 + kit.look, 72, 6.4, kit.ink),
        eye(kindAt(kit.eyes, 1), 146 + kit.look, 68, 6.8, kit.ink)
      ),
  },
  snake: {
    colors: [
      ["#7fc7a0", "#f7d774"],
      ["#f2a33a", "#f4e6ce"],
      ["#8e9ad6", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        // Coils, stacked from the bottom edge.
        ellipse(100, 196, 84, 30, kit.body),
        ellipse(100, 198, 60, 14, kit.second),
        ellipse(100, 166, 66, 24, kit.body),
        ellipse(100, 170, 46, 10, kit.second),
        // The neck, rising, and the head on it.
        path(
          "M76,170 C70,150 72,132 82,118 L118,118 C126,132 128,150 122,170 Z",
          kit.body
        ),
        ellipse(100, 98, 54, 44, kit.body),
        faded(0.2, [
          ...both((side) => ellipse(100 + side * 18, 66, 7, 5, INK)),
          ellipse(100, 74, 6, 4.4, INK),
        ]),
        both((side) => ellipse(100 + side * 8, 116, 2.4, 3, kit.ink)),
        grin(124, 14, 2, kit.ink),
        tongue(128, PINK),
        eyes(kit, 26, 96, 7)
      ),
  },
  frog: {
    colors: [
      ["#98cf82", "#ddebb5"],
      ["#7fc7a0", "#cfebd9"],
    ],
    draw: (kit) =>
      figure(
        shoulders(kit.body, 64, 150),
        chest(kit.second, 40, 160),
        // A wide flat head, and the eyes on top of it.
        ellipse(100, 120, 72, 48, kit.body),
        both((side) => ellipse(100 + side * 36, 80, 26, 24, kit.body)),
        both((side) => ellipse(100 + side * 36, 80, 18, 17, PEARL)),
        both((side) => ellipse(100 + side * 52, 126, 10, 6, "#f4a3a8")),
        line("M48,124 C70,146 130,146 152,124", kit.ink, 3.6),
        eyes(kit, 36, 80, 8)
      ),
  },
  axolotl: {
    colors: [
      ["#f4c7cf", "#ec9ab0"],
      ["#dcd3f4", "#aeb8f5"],
    ],
    draw: (kit) =>
      figure(
        // Three feathery gills on each side of the head.
        both((side) =>
          Arr.map([-26, 0, 26], (turn, index) =>
            ellipse(
              100 + side * (74 + (index === 1 ? 8 : 0)),
              104 + turn * 1.2,
              24,
              9,
              kit.second,
              side * turn
            )
          )
        ),
        shoulders(kit.body, 54, 150),
        chest(PEARL, 26, 176),
        ellipse(100, 112, 68, 52, kit.body),
        smile(126, 14, 6, kit.ink),
        eyes(kit, 40, 106, 6.4)
      ),
  },
} satisfies Record<string, Design>;

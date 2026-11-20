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
  head,
  INK,
  kindAt,
  line,
  PEARL,
  path,
  rounded,
  shoulders,
  spikes,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The orange of a bill or a beak. */
const BEAK = "#f2a33a";

/** The red of a comb, a wattle, or a casque. */
const RED = "#e5534b";

/** A plump bird, its head and its body one round shape that rises from the bottom edge. */
function plump(fill: string, top: number, half = 66) {
  return path(
    `M${100 - half},200 C${96 - half},150 ${108 - half},${top} 100,${top} C${92 + half},${top} ${104 + half},150 ${100 + half},200 Z`,
    fill
  );
}

/** A folded wing on each side, from the shoulder down past the bottom edge. */
function wings(fill: string, dx: number, y = 140) {
  return both((side) =>
    ellipse(100 + side * dx, y + 34, 22, 44, fill, side * -14)
  );
}

/** A short beak pointing down: a rounded triangle under the eyes. */
function beak(y: number, wide: number, deep: number, fill: string) {
  return blob([100 - wide, y, 100 + wide, y, 100, y + deep], fill, 6);
}

/** The birds, from the farmyard to the forest canopy and the shore. */
export const bird = {
  chicken: {
    colors: [
      ["#f7d774", "#ee8a4c"],
      ["#f3e7a6", "#f2a33a"],
    ],
    draw: (kit) =>
      figure(
        // The comb, three round lobes on the crown.
        ellipse(86, 54, 12, 14, RED),
        ellipse(100, 46, 13, 16, RED),
        ellipse(114, 54, 12, 14, RED),
        plump(kit.body, 52),
        wings(kit.body, 60),
        beak(118, 12, 14, kit.second),
        ellipse(100, 140, 6, 9, RED),
        eyes(kit, 26, 106)
      ),
  },
  owl: {
    colors: [
      ["#c9a27e", "#f4e6ce"],
      ["#c9d2dc", PEARL],
      ["#aeb8f5", PEARL],
    ],
    draw: (kit) =>
      figure(
        // Ear tufts.
        both((side) =>
          blob(
            [100 + side * 26, 66, 100 + side * 58, 26, 100 + side * 62, 80],
            kit.body,
            12
          )
        ),
        plump(kit.body, 52, 68),
        wings(kit.body, 62),
        // The facial disc, two rounds about the eyes.
        both((side) => ellipse(100 + side * 25, 106, 28, 30, kit.second)),
        // Marks on the chest.
        faded(0.22, [
          ...Arr.map([-24, 0, 24], (x) =>
            line(
              `M${100 + x - 7},160 L${100 + x},166 L${100 + x + 7},160`,
              INK,
              3.4
            )
          ),
          ...Arr.map([-12, 12], (x) =>
            line(
              `M${100 + x - 7},178 L${100 + x},184 L${100 + x + 7},178`,
              INK,
              3.4
            )
          ),
        ]),
        beak(122, 7, 13, BEAK),
        eyes(kit, 25, 106, 8)
      ),
  },
  penguin: {
    colors: [
      ["#5b6b8c", PEARL],
      ["#7c8fc4", PEARL],
    ],
    draw: (kit) =>
      figure(
        plump(kit.body, 50, 66),
        both((side) =>
          ellipse(100 + side * 66, 174, 14, 36, kit.body, side * -18)
        ),
        // The pale face, a heart that runs down into the belly.
        path(
          "M100,84 C114,70 146,70 148,98 C150,120 136,140 130,160 C128,178 130,192 132,200 L68,200 C70,192 72,178 70,160 C64,140 50,120 52,98 C54,70 86,70 100,84 Z",
          kit.second
        ),
        beak(118, 9, 12, BEAK),
        eyes(kit, 24, 104)
      ),
  },
  duck: {
    colors: [
      [PEARL, "#f2a33a"],
      ["#f7d774", "#ee8a4c"],
      ["#9fd6b8", "#f2a33a"],
    ],
    draw: (kit) =>
      figure(
        // A curl of feathers on the crown.
        line("M100,58 C98,42 108,34 118,38", kit.body, 9),
        plump(kit.body, 54, 66),
        wings(kit.body, 64),
        faded(
          0.16,
          both((side) =>
            line(
              `M${100 + side * 58},158 C${100 + side * 62},176 ${100 + side * 62},190 ${100 + side * 58},200`,
              INK,
              3
            )
          )
        ),
        // The wide flat bill, in two halves.
        rounded(
          "M64,124 C64,112 80,110 100,110 C120,110 136,112 136,124 C136,132 120,136 100,136 C80,136 64,132 64,124 Z",
          kit.second,
          4
        ),
        rounded(
          "M72,136 C80,140 120,140 128,136 C126,146 114,150 100,150 C86,150 74,146 72,136 Z",
          kit.second,
          4
        ),
        faded(0.25, [line("M70,135 Q100,141 130,135", INK, 2.6)]),
        both((side) => ellipse(100 + side * 8, 118, 2.4, 2, kit.ink)),
        eyes(kit, 28, 96)
      ),
  },
  cockatoo: {
    colors: [
      [PEARL, "#f7d774"],
      ["#f4c7cf", "#ec9ab0"],
    ],
    draw: (kit) =>
      figure(
        // The crest, fanned up and back.
        Arr.map([-30, -15, 0, 15, 30], (turn, index) =>
          ellipse(
            100 + turn * 0.5,
            34 + Math.abs(turn) * 0.3,
            9,
            30 - (index % 2) * 4,
            kit.second,
            turn
          )
        ),
        plump(kit.body, 56, 64),
        wings(kit.body, 60),
        both((side) => ellipse(100 + side * 34, 120, 11, 8, "#f4a3a8")),
        // A heavy hooked beak.
        rounded(
          "M84,112 C84,100 116,100 116,112 C116,128 108,140 98,146 C100,136 92,126 84,120 Z",
          "#5b6b8c",
          4
        ),
        eyes(kit, 30, 104)
      ),
  },
  hornbill: {
    colors: [
      ["#5b6b8c", PEARL],
      ["#6d4b78", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        plump(kit.body, 60, 64),
        chest(kit.second, 30, 176),
        // The bill, long and bent, and the red casque on top of it.
        rounded(
          "M88,106 C94,76 124,70 138,96 C128,92 116,94 108,104 Z",
          RED,
          4
        ),
        rounded(
          "M84,112 C96,100 126,102 152,140 C160,154 150,160 142,150 C128,134 108,126 90,128 Z",
          "#f7c94f",
          4
        ),
        both((side) =>
          ellipse(100 + side * 30 + kit.look, 100, 13, 13, kit.second)
        ),
        eyes(kit, 30, 100, 6.4)
      ),
  },
  eagle: {
    colors: [
      ["#8f6a4f", PEARL],
      ["#a8794f", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        plump(kit.body, 70, 70),
        // The white head, ragged where it meets the brown.
        spikes(100, 126, 40, 60, 20, 160, 7, kit.second, 6),
        head(kit.second, 58, 52, 104),
        // A hooked yellow beak and a stern, kind brow.
        rounded(
          "M80,118 C80,104 120,104 120,118 C120,136 112,148 98,154 C102,142 96,130 80,124 Z",
          "#f7c94f",
          4
        ),
        both((side) =>
          line(`M${100 + side * 14},88 L${100 + side * 40},94`, kit.ink, 4)
        ),
        eyes(kit, 27, 104, 6.4)
      ),
  },
  parrot: {
    colors: [
      ["#ee6a5a", "#f7d774"],
      ["#7fc7a0", "#f7d774"],
      ["#6fb1e8", "#f7d774"],
    ],
    draw: (kit) =>
      figure(
        plump(kit.body, 54, 64),
        both((side) =>
          ellipse(100 + side * 62, 176, 22, 44, kit.second, side * -14)
        ),
        wings(kit.body, 56),
        // The bare pale face about the eye.
        both((side) => ellipse(100 + side * 31, 102, 17, 16, PEARL)),
        // The great hooked bill: a pale upper half over a dark lower one.
        rounded(
          "M88,130 C92,140 108,140 112,130 C110,142 104,148 98,148 C92,146 90,138 88,130 Z",
          kit.ink,
          4
        ),
        rounded(
          "M78,118 C78,98 122,96 124,116 C126,136 114,152 100,158 C104,142 98,128 78,124 Z",
          PEARL,
          4
        ),
        eyes(kit, 31, 102, 6.4)
      ),
  },
  flamingo: {
    colors: [
      ["#f48fb1", PEARL],
      ["#f7a8a0", PEARL],
    ],
    draw: (kit) =>
      figure(
        // A wing folded at the bottom, the S of the neck over it.
        ellipse(120, 196, 54, 34, kit.body),
        line(
          "M90,200 C80,176 112,160 116,138 C120,116 98,100 98,84",
          kit.body,
          26
        ),
        ellipse(98, 76, 34, 32, kit.body),
        // The bill, bent down, with its dark tip.
        rounded(
          "M108,76 C128,70 146,80 148,98 C148,104 144,108 140,102 C134,92 122,88 110,92 Z",
          kit.second,
          4
        ),
        rounded(
          "M140,96 C144,98 148,98 150,96 C152,104 148,112 140,110 Z",
          kit.ink,
          4
        ),
        eye(kindAt(kit.eyes, 1), 96 + kit.look, 72, 6.4, kit.ink),
        eye(kindAt(kit.eyes, -1), 76 + kit.look, 74, 5.4, kit.ink)
      ),
  },
  peacock: {
    colors: [
      ["#3f7fc4", "#7fc7a0"],
      ["#2f9a8f", "#f7d774"],
    ],
    draw: (kit) =>
      figure(
        // The fan of the tail, each feather ending in an eye.
        Arr.map(Arr.range(0, 8), (index) => {
          const angle = ((200 + index * 17.5) * Math.PI) / 180;
          return ellipse(
            100 + Math.cos(angle) * 78,
            150 + Math.sin(angle) * 78,
            22,
            24,
            kit.second
          );
        }),
        Arr.map(Arr.range(0, 8), (index) => {
          const angle = ((200 + index * 17.5) * Math.PI) / 180;
          return ellipse(
            100 + Math.cos(angle) * 80,
            150 + Math.sin(angle) * 80,
            9,
            10,
            "#2f4f8f"
          );
        }),
        // The crest: three stalks, each with its tuft.
        Arr.flatMap([-12, 0, 12], (x) => [
          line(`M${100 + x * 0.5},64 L${100 + x},40`, kit.body, 3),
          ellipse(100 + x, 38, 5, 6, kit.body),
        ]),
        shoulders(kit.body, 40, 150),
        head(kit.body, 44, 46, 104),
        both((side) => ellipse(100 + side * 22, 100, 14, 6, PEARL, side * 10)),
        beak(120, 7, 12, "#5b6b8c"),
        eyes(kit, 20, 102, 6)
      ),
  },
  cassowary: {
    colors: [
      ["#2f3a56", "#3f8fd0"],
      ["#34344a", "#4aa3c7"],
    ],
    draw: (kit) =>
      figure(
        // Shaggy black plumage.
        spikes(100, 230, 80, 110, 220, 320, 9, kit.body, 8),
        shoulders(kit.body, 70, 150),
        // The bare blue neck and its two red wattles.
        path(
          "M76,200 C78,170 80,150 82,130 L118,130 C120,150 122,170 124,200 Z",
          kit.second
        ),
        both((side) => ellipse(100 + side * 9, 162, 7, 18, RED)),
        head(kit.second, 40, 40, 100),
        // The blade of the casque, and the bill.
        rounded(
          "M84,74 C84,44 96,22 108,16 C114,32 116,52 116,74 Z",
          "#c99a5a",
          6
        ),
        rounded(
          "M84,112 C88,104 112,104 116,112 C112,124 104,132 100,134 C96,132 88,124 84,112 Z",
          "#5b6b8c",
          4
        ),
        eyes(kit, 22, 96, 6)
      ),
  },
} satisfies Record<string, Design>;

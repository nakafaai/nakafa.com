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
  roundEars,
  smile,
  torso,
} from "@repo/mascot/kit";

/** The wild grazers and browsers, from the forest edge to the savanna and the river. */
export const wild = {
  anoa: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#c89468", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        // Short straight horns, ringed at the base, lean back from the brow.
        both((side) => [
          blob(
            [100 + side * 16, 56, 100 + side * 32, 54, 100 + side * 44, 10],
            kit.second,
            9
          ),
          faded(0.2, [
            line(`M${100 + side * 20},46 L${100 + side * 34},44`, kit.ink, 3),
            line(`M${100 + side * 25},34 L${100 + side * 37},32`, kit.ink, 3),
          ]),
        ]),
        both((side) => [
          ellipse(100 + side * 60, 84, 20, 10, kit.body, side * -16),
          ellipse(100 + side * 60, 85, 12, 5, kit.second, side * -16),
        ]),
        torso(kit.body, 54),
        // The pale crescent across the throat.
        path("M62,150 Q100,182 138,150 Q100,168 62,150 Z", kit.second),
        line("M62,150 Q100,176 138,150", kit.second, 9),
        head(kit.body, 52, 52, 98),
        // A darker brow, pale cheek spots, and the broad wet nose of a buffalo.
        faded(0.14, [ellipse(100, 62, 30, 14, kit.ink)]),
        both((side) => ellipse(100 + side * 36, 114, 8, 6, kit.second)),
        ellipse(100, 126, 28, 19, kit.second),
        ellipse(100, 120, 15, 9, kit.ink),
        both((side) => ellipse(100 + side * 6, 120, 2.6, 3, kit.second)),
        line("M90,136 Q100,142 110,136", kit.ink, 2.8),
        eyes(kit, 26, 92)
      ),
  },
  deer: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#d9a36a", PEARL],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          line(
            `M${100 + side * 22},58 Q${100 + side * 30},32 ${100 + side * 46},14`,
            kit.second,
            7.4
          ),
          line(
            `M${100 + side * 29},38 L${100 + side * 52},36`,
            kit.second,
            7.4
          ),
          line(
            `M${100 + side * 25},50 L${100 + side * 12},30`,
            kit.second,
            7.4
          ),
        ]),
        both((side) => [
          ellipse(100 + side * 62, 82, 20, 10, kit.body, side * -24),
          ellipse(100 + side * 62, 82, 11, 5, kit.second, side * -24),
        ]),
        torso(kit.body),
        head(kit.body, 54, 52, 98),
        both((side) => [
          ellipse(100 + side * 18, 62, 3.6, 3.6, kit.second),
          ellipse(100 + side * 32, 70, 3, 3, kit.second),
        ]),
        ellipse(100, 122, 23, 18, kit.second),
        belly(kit.second),
        eyes(kit, 27, 94),
        nose(114, 7.4, 5.4, kit.ink),
        smile(124, 7, 6, kit.ink)
      ),
  },
  giraffe: {
    colors: [
      ["#f7d774", "#c9783a"],
      ["#f3e7a6", "#d9824a"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          line(`M${100 + side * 16},52 L${100 + side * 20},28`, kit.body, 9),
          ellipse(100 + side * 20, 24, 8, 8, kit.second),
        ]),
        both((side) =>
          ellipse(100 + side * 54, 70, 17, 9, kit.body, side * -22)
        ),
        path(
          "M68,200 C70,170 74,140 78,116 L122,116 C126,140 130,170 132,200 Z",
          kit.body
        ),
        head(kit.body, 46, 42, 84),
        ellipse(86, 152, 9, 11, kit.second),
        ellipse(113, 170, 10, 12, kit.second),
        ellipse(106, 138, 7, 8, kit.second),
        ellipse(84, 186, 8, 9, kit.second),
        ellipse(70, 62, 7, 6, kit.second),
        ellipse(128, 56, 6, 5, kit.second),
        ellipse(100, 104, 29, 20, "#f4e6ce"),
        eyes(kit, 25, 78),
        both((side) => ellipse(100 + side * 8, 102, 2.6, 3.4, kit.ink)),
        smile(110, 8, 6, kit.ink)
      ),
  },
  zebra: {
    colors: [
      [PEARL, PEARL],
      ["#f4e6ce", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          blob(
            [100 + side * 44, 60, 100 + side * 48, 26, 100 + side * 24, 48],
            kit.body,
            12
          ),
          blob(
            [100 + side * 42, 50, 100 + side * 44, 36, 100 + side * 34, 46],
            kit.ink,
            4
          ),
        ]),
        blob([92, 50, 96, 22, 108, 50], kit.ink, 8),
        torso(kit.body),
        head(kit.body, 50, 54, 98),
        blob([100, 56, 96, 74, 104, 74], kit.ink, 3.4),
        both((side) => [
          blob(
            [100 + side * 50, 80, 100 + side * 30, 84, 100 + side * 49, 90],
            kit.ink,
            3.4
          ),
          blob(
            [100 + side * 52, 100, 100 + side * 34, 102, 100 + side * 50, 108],
            kit.ink,
            3.4
          ),
          blob(
            [100 + side * 22, 58, 100 + side * 18, 72, 100 + side * 27, 70],
            kit.ink,
            3.2
          ),
          blob(
            [100 + side * 58, 156, 100 + side * 38, 162, 100 + side * 60, 168],
            kit.ink,
            3.4
          ),
          blob(
            [100 + side * 60, 180, 100 + side * 40, 186, 100 + side * 60, 192],
            kit.ink,
            3.4
          ),
        ]),
        ellipse(100, 130, 30, 20, kit.ink),
        both((side) => ellipse(100 + side * 9, 130, 2.8, 3.6, kit.body)),
        eyes(kit, 24, 94)
      ),
  },
  hippo: {
    colors: [
      ["#b9a7d6", "#f4c7cf"],
      ["#aab8d8", "#f6c3a6"],
      ["#c9b6c8", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 40, 48, 12),
        torso(kit.body, 62),
        head(kit.body, 54, 44, 88),
        both((side) =>
          path(
            `M${100 + side * 16 - 6},146 L${100 + side * 16 + 6},146 L${100 + side * 16 + 5},158 L${100 + side * 16 - 5},158 Z`,
            PEARL
          )
        ),
        ellipse(100, 122, 56, 32, kit.body),
        both((side) => ellipse(100 + side * 20, 110, 5, 6.4, kit.ink)),
        eyes(kit, 26, 82),
        line("M66,138 Q100,150 134,138", kit.ink, 4.4)
      ),
  },
  rhino: {
    colors: [
      ["#c9d2dc", PEARL],
      ["#b9c0cc", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        // Tube ears, open to the front.
        both((side) => [
          ellipse(100 + side * 46, 48, 14, 22, kit.body, side * 22),
          ellipse(100 + side * 46, 50, 7, 13, "#f4c7cf", side * 22),
        ]),
        torso(kit.body, 60),
        faded(0.14, [line("M52,168 Q100,184 148,168", kit.ink, 5)]),
        head(kit.body, 56, 48, 90),
        // The wide square lip under the head.
        path(
          "M50,112 C50,96 150,96 150,112 L152,136 C152,152 130,160 100,160 C70,160 48,152 48,136 Z",
          kit.body
        ),
        faded(0.1, [
          path(
            "M50,112 C50,96 150,96 150,112 L152,136 C152,152 130,160 100,160 C70,160 48,152 48,136 Z",
            kit.ink
          ),
        ]),
        eyes(kit, 34, 84),
        both((side) => ellipse(100 + side * 30, 134, 4, 5, kit.ink)),
        line("M78,148 Q100,156 122,148", kit.ink, 3.4),
        // The small horn behind, then the great horn in front of it.
        blob([92, 74, 108, 74, 100, 52], kit.second, 8),
        path(
          "M80,124 C82,96 90,62 106,34 C112,64 118,98 120,124 C110,134 90,134 80,124 Z",
          kit.second
        ),
        faded(0.16, [
          path(
            "M80,124 C81,116 82,110 84,104 C96,110 106,110 117,104 C118,110 119,116 120,124 C110,134 90,134 80,124 Z",
            kit.ink
          ),
        ])
      ),
  },
  elephant: {
    colors: [
      ["#c9d2dc", "#f4c7cf"],
      ["#cfe6f7", PEARL],
      ["#b9c0cc", PEARL],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 62, 96, 40, 46, kit.body),
          ellipse(100 + side * 64, 98, 24, 30, kit.second),
        ]),
        torso(kit.body, 50),
        head(kit.body, 50, 52, 96),
        belly(kit.second, 36, 136),
        both((side) =>
          ellipse(100 + side * 24, 132, 5.6, 11, PEARL, side * -12)
        ),
        path(
          "M84,112 C84,150 88,178 100,190 C112,178 116,150 116,112 Z",
          kit.body
        ),
        eyes(kit, 26, 90)
      ),
  },
} satisfies Record<string, Design>;

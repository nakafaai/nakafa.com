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
  path,
  roundEars,
  smile,
  torso,
  WHITE,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The animals that stand on hooves, and the elephant and the rhino beside them. */
export const hoofed = {
  domba: {
    colors: [
      ["#f6f4ef", "#efd2a6"],
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
  sapi: {
    colors: [
      ["#f6f4ef", "#f4c7cf"],
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
  anoa: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#c89468", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        both((side) =>
          blob(
            [100 + side * 18, 56, 100 + side * 30, 54, 100 + side * 40, 14],
            kit.second,
            8
          )
        ),
        both((side) =>
          ellipse(100 + side * 62, 82, 18, 9, kit.body, side * -18)
        ),
        torso(kit.body),
        head(kit.body, 54, 52, 98),
        both((side) => ellipse(100 + side * 34, 116, 9, 6, kit.second)),
        ellipse(100, 126, 24, 16, kit.second),
        eyes(kit, 26, 94),
        both((side) => ellipse(100 + side * 8, 126, 2.8, 3.6, kit.ink))
      ),
  },
  babi: {
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
  rusa: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#d9a36a", "#f6f4ef"],
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
  jerapah: {
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
      ["#f6f4ef", "#f6f4ef"],
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
  "kuda-nil": {
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
            WHITE
          )
        ),
        ellipse(100, 122, 56, 32, kit.body),
        both((side) => ellipse(100 + side * 20, 110, 5, 6.4, kit.ink)),
        eyes(kit, 26, 82),
        line("M66,138 Q100,150 134,138", kit.ink, 4.4)
      ),
  },
  kuda: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#8f6a4f", "#efd2a6"],
      ["#b9c0cc", "#f6f4ef"],
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
  kambing: {
    colors: [
      ["#f6f4ef", "#c9a27e"],
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
  alpaka: {
    colors: [
      ["#f4e6ce", "#f6f4ef"],
      ["#c9a27e", "#f4e6ce"],
      ["#f6f4ef", "#f4c7cf"],
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
  badak: {
    colors: [
      ["#c9d2dc", "#f6f4ef"],
      ["#b9c0cc", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        both((side) =>
          blob(
            [100 + side * 44, 62, 100 + side * 52, 36, 100 + side * 30, 54],
            kit.body,
            10
          )
        ),
        torso(kit.body, 60),
        head(kit.body, 60, 54, 100),
        blob([90, 116, 110, 116, 100, 78], kit.second, 8),
        blob([94, 80, 106, 80, 100, 62], kit.second, 6),
        eyes(kit, 34, 96),
        both((side) => ellipse(100 + side * 14, 132, 3.4, 4.2, kit.ink))
      ),
  },
  gajah: {
    colors: [
      ["#c9d2dc", "#f4c7cf"],
      ["#cfe6f7", "#f6f4ef"],
      ["#b9c0cc", "#f6f4ef"],
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
          ellipse(100 + side * 24, 132, 5.6, 11, WHITE, side * -12)
        ),
        path(
          "M84,112 C84,150 88,178 100,190 C112,178 116,150 116,112 Z",
          kit.body
        ),
        eyes(kit, 26, 90)
      ),
  },
} satisfies Record<string, Design>;

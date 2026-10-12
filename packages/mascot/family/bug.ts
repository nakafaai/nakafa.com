import {
  both,
  type Design,
  ellipse,
  eye,
  eyes,
  figure,
  head,
  kindAt,
  line,
  outlined,
  path,
  smile,
  torso,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The insects, the spider, and the snail: the small ones that crawl and fly. */
export const bug = {
  bee: {
    colors: [
      ["#f7d774", "#cfe6f7"],
      ["#e8b456", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          line(
            `M${100 + side * 16},56 Q${100 + side * 20},34 ${100 + side * 34},28`,
            kit.ink,
            4.6
          ),
          ellipse(100 + side * 36, 27, 5.4, 5.4, kit.ink),
        ]),
        both((side) =>
          ellipse(100 + side * 62, 146, 24, 36, kit.second, side * 22)
        ),
        torso(kit.body),
        path("M53,152 L147,152 L151,170 L49,170 Z", kit.ink),
        path("M46,184 L154,184 L156,200 L44,200 Z", kit.ink),
        head(kit.body),
        eyes(kit, 24, 96),
        smile(110, 10, 9, kit.ink)
      ),
  },
  beetle: {
    colors: [
      ["#ee6a5a", "#f4e6ce"],
      ["#f2a33a", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          line(
            `M${100 + side * 14},52 Q${100 + side * 18},30 ${100 + side * 34},24`,
            kit.ink,
            4.6
          ),
          ellipse(100 + side * 36, 23, 5.4, 5.4, kit.ink),
        ]),
        path(
          "M20,200 C20,144 54,108 100,108 C146,108 180,144 180,200 Z",
          kit.body
        ),
        line("M100,112 L100,200", kit.ink, 4),
        both((side) => [
          ellipse(100 + side * 40, 150, 11, 11, kit.ink),
          ellipse(100 + side * 26, 186, 8, 8, kit.ink),
          ellipse(100 + side * 64, 184, 7, 7, kit.ink),
        ]),
        ellipse(100, 86, 44, 40, kit.second),
        eyes(kit, 20, 84),
        smile(96, 10, 8, kit.ink)
      ),
  },
  dragonfly: {
    colors: [
      ["#5fbfa8", "#cfe6f7"],
      ["#6fb1e8", "#dcd3f4"],
      ["#ee6a5a", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 54, 100, 50, 17, kit.second, side * -18),
          ellipse(100 + side * 50, 132, 42, 14, kit.second, side * 14),
        ]),
        ellipse(100, 172, 11, 52, kit.body),
        line("M91,150 H109 M92,166 H108 M93,182 H107", kit.second, 2.8),
        ellipse(100, 120, 18, 22, kit.body),
        ellipse(100, 86, 28, 24, kit.body),
        both((side) => [
          ellipse(100 + side * 17, 80, 15, 16, kit.second),
          eye(
            kindAt(kit.eyes, side),
            100 + side * 17 + kit.look,
            82,
            5.2,
            kit.ink
          ),
        ]),
        smile(98, 6, 4.6, kit.ink)
      ),
  },
  butterfly: {
    colors: [
      ["#f2a33a", "#f7d774"],
      ["#8e9ad6", "#dcd3f4"],
      ["#ee6a5a", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 54, 98, 44, 56, kit.body, side * -12),
          ellipse(100 + side * 58, 94, 21, 28, kit.second, side * -12),
          ellipse(100 + side * 46, 164, 32, 36, kit.body, side * 14),
          ellipse(100 + side * 50, 164, 14, 17, kit.second, side * 14),
        ]),
        both((side) => [
          line(
            `M${100 + side * 9},72 Q${100 + side * 20},46 ${100 + side * 30},40`,
            kit.ink,
            3.6
          ),
          ellipse(100 + side * 30, 40, 4.2, 4.2, kit.ink),
        ]),
        ellipse(100, 164, 17, 56, kit.second),
        ellipse(100, 94, 27, 25, kit.second),
        eyes(kit, 10, 90, 4.8),
        smile(101, 6, 5, kit.ink)
      ),
  },
  spider: {
    colors: [
      ["#6d5aa8", "#dcd3f4"],
      ["#4b6a8f", "#cfe6f7"],
      ["#8c5a4f", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        Arr.flatMap(Arr.range(0, 3), (index) =>
          both((side) =>
            line(
              `M${100 + side * 40},${118 + index * 14} Q${100 + side * (76 + index * 4)},${84 + index * 18} ${100 + side * (94 - index * 2)},${122 + index * 24}`,
              kit.body,
              7.5
            )
          )
        ),
        ellipse(100, 166, 56, 52, kit.body),
        ellipse(100, 172, 15, 20, kit.second),
        ellipse(100, 106, 46, 42, kit.body),
        both((side) => [
          ellipse(100 + side * 18, 102, 13.5, 14.5, kit.second),
          ellipse(100 + side * 31, 80, 4.6, 4.6, kit.second),
        ]),
        eyes(kit, 18, 102, 5.6),
        smile(121, 8, 6, kit.ink)
      ),
  },
  snail: {
    colors: [
      ["#f6c3a6", "#b98a63"],
      ["#f3e7a6", "#c9783a"],
      ["#cfebd9", "#5e8f9c"],
    ],
    draw: (kit) =>
      figure(
        ellipse(132, 126, 58, 58, kit.second),
        line(
          "M132,130 C120,130 118,114 132,112 C152,110 160,140 136,150 C104,160 86,124 108,100",
          kit.body,
          7
        ),
        line("M62,92 L56,58", kit.body, 9),
        line("M90,90 L98,56", kit.body, 9),
        ellipse(55, 50, 12, 12, kit.body),
        ellipse(99, 48, 12, 12, kit.body),
        path(
          "M14,200 C16,176 36,164 70,164 L186,164 C194,176 194,190 192,200 Z",
          kit.body
        ),
        ellipse(76, 122, 38, 44, kit.body),
        eye(kindAt(kit.eyes, -1), 55 + kit.look, 50, 5.4, kit.ink),
        eye(kindAt(kit.eyes, 1), 99 + kit.look, 48, 5.4, kit.ink),
        outlined(
          "M62,124 Q76,134 90,124 Q76,142 62,124 Z",
          kit.ink,
          kit.ink,
          2.6
        )
      ),
  },
} satisfies Record<string, Design>;

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
  head,
  INK,
  kindAt,
  line,
  mew,
  nose,
  PEARL,
  PINK,
  path,
  pointEars,
  roundEars,
  rounded,
  shoulders,
  smile,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The cheek tufts of a cat: a point on each side under the eyes. */
function tufts(fill: string, y = 122) {
  return both((side) =>
    blob(
      [
        100 + side * 52,
        y - 18,
        100 + side * 72,
        y + 6,
        100 + side * 46,
        y + 14,
      ],
      fill,
      10
    )
  );
}

/** Three short stripes on the forehead, in a darker tone of the body. */
function brow(width = 7) {
  return faded(0.22, [
    line("M100,52 L100,66", INK, width),
    line("M84,55 L87,66", INK, width - 1),
    line("M116,55 L113,66", INK, width - 1),
  ]);
}

/** The meat eaters on land, and the seals and walruses that hunt in the sea. */
export const carnivore = {
  cat: {
    colors: [
      ["#ee8a4c", "#f4e6ce"],
      ["#c9d2dc", PEARL],
      ["#efd2a6", PEARL],
    ],
    draw: (kit) =>
      figure(
        pointEars(kit.body, PINK, 56, 26, 66),
        shoulders(kit.body, 58),
        chest(kit.second, 28),
        tufts(kit.body),
        head(kit.body, 64, 54, 106),
        brow(),
        both((side) => ellipse(100 + side * 12, 130, 15, 12, kit.second)),
        eyes(kit, 27, 104),
        nose(121, 7, 5, PINK),
        mew(128, 9, kit.ink)
      ),
  },
  bear: {
    colors: [
      ["#c89468", "#f4e6ce"],
      [PEARL, "#c9d2dc"],
      ["#e8b456", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 50, 58, 21),
        shoulders(kit.body, 64),
        head(kit.body, 64, 56, 106),
        ellipse(100, 132, 27, 21, kit.second),
        eyes(kit, 27, 104),
        nose(122, 10, 8, kit.ink),
        line("M100,124 L100,132", kit.ink, 3.2),
        grin(132, 8, 2.4, kit.ink)
      ),
  },
  fox: {
    colors: [
      ["#ee8a4c", PEARL],
      ["#f2a33a", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        pointEars(kit.body, INK, 60, 18, 66),
        shoulders(kit.body, 56),
        chest(kit.second, 26),
        rounded(
          "M100,52 C132,52 156,66 160,92 L174,126 L148,132 C136,150 118,160 100,164 C82,160 64,150 52,132 L26,126 L40,92 C44,66 68,52 100,52 Z",
          kit.body,
          8
        ),
        rounded(
          "M30,124 C56,114 82,120 100,138 C118,120 144,114 170,124 L148,132 C136,150 118,160 100,164 C82,160 64,150 52,132 Z",
          kit.second,
          8
        ),
        eyes(kit, 27, 100),
        nose(138, 9, 7, kit.ink),
        grin(147, 6, 2, kit.ink)
      ),
  },
  panda: {
    colors: [
      [PEARL, PEARL],
      ["#f4e6ce", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.ink, null, 50, 56, 21),
        shoulders(kit.body, 66),
        path(
          "M34,200 C40,176 60,162 84,160 L116,160 C140,162 160,176 166,200 Z",
          kit.ink
        ),
        head(kit.body, 66, 56, 106),
        both((side) =>
          ellipse(100 + side * 27, 106, 16, 21, kit.ink, side * 26)
        ),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 26 + kit.look,
            104,
            6,
            kit.body
          )
        ),
        nose(126, 9, 7, kit.ink),
        grin(135, 7, 2.2, kit.ink)
      ),
  },
  tiger: {
    colors: [
      ["#f2a33a", "#f4e6ce"],
      ["#ee8a4c", PEARL],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 50, 60, 19),
        shoulders(kit.body, 60),
        chest(kit.second, 28),
        tufts(kit.body, 128),
        head(kit.body, 66, 56, 106),
        blob([100, 50, 93, 66, 107, 66], kit.ink, 5),
        both((side) => [
          blob(
            [100 + side * 22, 54, 100 + side * 18, 70, 100 + side * 28, 68],
            kit.ink,
            4
          ),
          blob(
            [100 + side * 66, 98, 100 + side * 46, 104, 100 + side * 64, 110],
            kit.ink,
            4
          ),
          blob(
            [100 + side * 64, 120, 100 + side * 48, 124, 100 + side * 60, 130],
            kit.ink,
            4
          ),
        ]),
        both((side) => ellipse(100 + side * 13, 131, 16, 13, kit.second)),
        eyes(kit, 27, 104),
        nose(122, 9, 7, PINK),
        mew(129, 9, kit.ink)
      ),
  },
  lion: {
    colors: [
      ["#e8b456", "#c9783a"],
      ["#f7d774", "#ee8a4c"],
    ],
    draw: (kit) =>
      figure(
        Arr.makeBy(14, (index) => {
          const angle = (index / 14) * Math.PI * 2;
          return ellipse(
            100 + Math.cos(angle) * 66,
            106 + Math.sin(angle) * 62,
            26,
            26,
            kit.second
          );
        }),
        ellipse(100, 106, 72, 68, kit.second),
        shoulders(kit.body, 54, 156),
        roundEars(kit.body, kit.second, 40, 62, 13),
        head(kit.body, 48, 46, 110),
        ellipse(100, 132, 22, 16, PEARL),
        eyes(kit, 20, 106, 6.4),
        nose(124, 9, 7, kit.ink),
        mew(131, 8, kit.ink)
      ),
  },
  dog: {
    colors: [
      ["#efd2a6", "#b98a63"],
      [PEARL, "#c89468"],
      ["#e8b456", "#a8683a"],
    ],
    draw: (kit) =>
      figure(
        shoulders(kit.body, 60),
        head(kit.body, 62, 56, 104),
        ellipse(124, 100, 21, 19, kit.second, 18),
        both((side) => [
          path(
            `M${100 + side * 40},62 C${100 + side * 66},56 ${100 + side * 82},76 ${100 + side * 80},110 C${100 + side * 78},134 ${100 + side * 66},144 ${100 + side * 58},138 C${100 + side * 52},118 ${100 + side * 50},88 ${100 + side * 40},62 Z`,
            kit.second
          ),
        ]),
        ellipse(100, 132, 25, 19, PEARL),
        eyes(kit, 25, 104),
        nose(122, 11, 8, kit.ink),
        smile(132, 9, 7, kit.ink),
        ellipse(100, 143, 6, 7, PINK)
      ),
  },
  civet: {
    colors: [
      ["#b9c0cc", PEARL],
      ["#c9a27e", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 44, 60, 14),
        shoulders(kit.body, 60),
        both((side) =>
          faded(0.5, [
            ellipse(100 + side * 50, 174, 7, 6, kit.ink),
            ellipse(100 + side * 56, 194, 7, 6, kit.ink),
            ellipse(100 + side * 36, 192, 6, 5, kit.ink),
          ])
        ),
        // The head narrows to a pointed snout.
        path(
          "M40,92 C40,62 68,52 100,52 C132,52 160,62 160,92 C160,118 120,170 100,170 C80,170 40,118 40,92 Z",
          kit.body
        ),
        // The mask: a dark patch round each eye that runs down to the snout,
        // a pale blaze between them, and a pale spot under each eye.
        both((side) =>
          path(
            `M${100 + side * 10},90 C${100 + side * 24},82 ${100 + side * 46},84 ${100 + side * 52},98 C${100 + side * 54},112 ${100 + side * 36},118 ${100 + side * 24},128 C${100 + side * 16},134 ${100 + side * 8},128 ${100 + side * 8},116 Z`,
            kit.ink
          )
        ),
        ellipse(100, 82, 8, 24, kit.second),
        both((side) =>
          ellipse(100 + side * 46, 122, 10, 7, kit.second, side * -30)
        ),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 30 + kit.look,
            100,
            6,
            kit.second
          )
        ),
        ellipse(100, 148, 16, 20, kit.second),
        nose(152, 8, 6, kit.ink),
        grin(161, 5, 1.6, kit.ink)
      ),
  },
  raccoon: {
    colors: [
      ["#9aa3b0", PEARL],
      ["#b8a58c", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 50, 60, 19),
        shoulders(kit.body, 62),
        chest(kit.second, 26),
        head(kit.body, 66, 56, 106),
        both((side) =>
          ellipse(100 + side * 30, 84, 18, 9, kit.second, side * 12)
        ),
        path(
          "M36,108 C44,92 70,90 100,100 C130,90 156,92 164,108 C156,124 128,124 100,116 C72,124 44,124 36,108 Z",
          kit.ink
        ),
        ellipse(100, 134, 26, 20, kit.second),
        both((side) =>
          eye(kindAt(kit.eyes, side), 100 + side * 28 + kit.look, 107, 6, PEARL)
        ),
        nose(126, 8, 6, kit.ink),
        grin(134, 7, 2.2, kit.ink)
      ),
  },
  seal: {
    colors: [
      ["#c9d2dc", PEARL],
      ["#cfe6f7", PEARL],
    ],
    draw: (kit) =>
      figure(
        path(
          "M32,200 C30,150 40,110 52,86 C64,62 82,52 100,52 C118,52 136,62 148,86 C160,110 170,150 168,200 Z",
          kit.body
        ),
        both((side) =>
          ellipse(100 + side * 60, 184, 14, 30, kit.body, side * -24)
        ),
        both((side) => ellipse(100 + side * 14, 124, 18, 14, kit.second)),
        both((side) => [
          ellipse(100 + side * 10, 122, 2.2, 2.2, kit.ink),
          ellipse(100 + side * 18, 126, 2.2, 2.2, kit.ink),
          ellipse(100 + side * 20, 118, 2.2, 2.2, kit.ink),
        ]),
        eyes(kit, 30, 98, 8),
        nose(114, 8, 6, kit.ink),
        grin(138, 6, 1.8, kit.ink)
      ),
  },
  walrus: {
    colors: [
      ["#b08968", "#f4e6ce"],
      ["#a8876f", PEARL],
    ],
    draw: (kit) =>
      figure(
        path(
          "M26,200 C24,150 34,104 56,78 C70,62 84,56 100,56 C116,56 130,62 144,78 C166,104 176,150 174,200 Z",
          kit.body
        ),
        both((side) =>
          blob(
            [100 + side * 10, 136, 100 + side * 22, 136, 100 + side * 18, 186],
            PEARL,
            9
          )
        ),
        both((side) => ellipse(100 + side * 18, 124, 24, 20, kit.second)),
        both((side) => [
          ellipse(100 + side * 12, 120, 2.2, 2.2, kit.ink),
          ellipse(100 + side * 24, 116, 2.2, 2.2, kit.ink),
          ellipse(100 + side * 22, 128, 2.2, 2.2, kit.ink),
        ]),
        eyes(kit, 30, 92, 6),
        nose(110, 9, 6, kit.ink)
      ),
  },
} satisfies Record<string, Design>;

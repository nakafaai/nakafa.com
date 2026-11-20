import type { Design } from "@repo/mascot/kit";
import {
  blob,
  both,
  chest,
  ellipse,
  eyes,
  faded,
  figure,
  grin,
  head,
  INK,
  line,
  mew,
  nose,
  PEARL,
  PINK,
  path,
  roundEars,
  rounded,
  shoulders,
  spikes,
} from "@repo/mascot/kit";

/** The small mammals: the ones that hop, gnaw, climb, bristle, or fly at night. */
export const small = {
  rabbit: {
    colors: [
      [PEARL, "#f4c7cf"],
      ["#dcd3f4", PEARL],
      ["#efd2a6", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        // Long ears, one bent over at its tip.
        ellipse(76, 40, 16, 40, kit.body, -8),
        ellipse(76, 44, 8, 30, kit.second, -8),
        path(
          "M118,70 C116,40 122,16 138,10 C154,6 160,22 152,38 C146,50 138,58 134,72 Z",
          kit.body
        ),
        path(
          "M124,66 C124,44 130,26 140,20 C148,18 150,28 146,36 C140,46 134,56 132,68 Z",
          kit.second
        ),
        shoulders(kit.body, 58),
        chest(kit.second, 24),
        head(kit.body, 60, 54, 110),
        both((side) => ellipse(100 + side * 10, 132, 13, 11, PEARL)),
        nose(124, 7, 5, PINK),
        mew(130, 8, kit.ink),
        eyes(kit, 27, 108)
      ),
  },
  hamster: {
    colors: [
      ["#e8b456", "#f4e6ce"],
      ["#efd2a6", PEARL],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, PINK, 48, 60, 16),
        shoulders(kit.body, 70),
        ellipse(100, 112, 72, 56, kit.body),
        // Full cheek pouches and the pale muzzle between them.
        both((side) => ellipse(100 + side * 36, 134, 34, 26, kit.second)),
        ellipse(100, 132, 22, 22, kit.second),
        ellipse(100, 80, 8, 18, kit.second),
        nose(124, 6, 4.4, PINK),
        mew(130, 7, kit.ink),
        eyes(kit, 28, 104, 6.4)
      ),
  },
  mouse: {
    colors: [
      ["#c9d2dc", "#f4c7cf"],
      ["#efd2a6", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 54, 62, 32),
        shoulders(kit.body, 56),
        chest(PEARL, 24),
        path(
          "M100,64 C134,64 152,86 152,112 C152,136 126,160 100,164 C74,160 48,136 48,112 C48,86 66,64 100,64 Z",
          kit.body
        ),
        faded(
          0.35,
          both((side) => [
            line(`M${100 + side * 22},146 L${100 + side * 50},140`, INK, 2.4),
            line(`M${100 + side * 22},152 L${100 + side * 48},156`, INK, 2.4),
          ])
        ),
        nose(146, 8, 6, PINK),
        grin(154, 5, 1.4, kit.ink, 2.8),
        eyes(kit, 22, 116, 6.4)
      ),
  },
  squirrel: {
    colors: [
      ["#d9824a", "#f4e6ce"],
      ["#b98a63", PEARL],
      ["#b9c0cc", PEARL],
    ],
    draw: (kit) =>
      figure(
        // The great tail, curled up behind one shoulder.
        path(
          "M130,200 C176,190 196,150 190,104 C186,70 166,46 140,44 C116,44 104,64 114,82 C128,76 148,82 154,104 C160,134 146,164 120,176 Z",
          kit.body
        ),
        path(
          "M150,92 C160,104 164,126 156,150 C150,166 140,176 128,182 C146,160 154,130 150,92 Z",
          kit.second
        ),
        // Tufted ears.
        both((side) => [
          blob(
            [100 + side * 22, 66, 100 + side * 40, 26, 100 + side * 54, 70],
            kit.body,
            12
          ),
          blob(
            [100 + side * 34, 30, 100 + side * 40, 16, 100 + side * 46, 32],
            kit.body,
            5
          ),
          blob(
            [100 + side * 32, 64, 100 + side * 40, 40, 100 + side * 48, 66],
            kit.second,
            5
          ),
        ]),
        shoulders(kit.body, 50),
        chest(kit.second, 24),
        head(kit.body, 54, 50, 108),
        both((side) => ellipse(100 + side * 28, 130, 22, 16, kit.second)),
        nose(124, 6, 4.4, kit.ink),
        mew(130, 7, kit.ink),
        eyes(kit, 24, 106, 6.4)
      ),
  },
  porcupine: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#8f6a4f", PEARL],
    ],
    draw: (kit) =>
      figure(
        // Quills fan out behind the head, each with a pale tip.
        spikes(100, 116, 52, 98, 170, 370, 15, kit.second, 8),
        spikes(100, 116, 46, 86, 170, 370, 15, kit.body, 8),
        faded(0.2, spikes(100, 116, 40, 72, 178, 362, 13, INK, 4)),
        shoulders(kit.body, 64),
        head(kit.body, 56, 52, 112),
        roundEars(kit.body, kit.second, 46, 82, 11),
        ellipse(100, 128, 42, 34, kit.second),
        nose(134, 10, 8, kit.ink),
        grin(144, 6, 1.6, kit.ink),
        eyes(kit, 22, 114, 6.4)
      ),
  },
  koala: {
    colors: [
      ["#c9d2dc", PEARL],
      ["#b9c0cc", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        // Great fluffy ears.
        both((side) => [
          ellipse(100 + side * 62, 76, 34, 32, kit.body),
          ellipse(100 + side * 64, 80, 20, 18, kit.second),
          ellipse(100 + side * 78, 64, 10, 10, kit.second),
          ellipse(100 + side * 82, 82, 9, 9, kit.second),
        ]),
        shoulders(kit.body, 62),
        chest(kit.second, 26),
        head(kit.body, 60, 54, 108),
        // The big dark nose.
        rounded(
          "M88,110 C88,100 112,100 112,110 L110,132 C108,142 92,142 90,132 Z",
          kit.ink,
          6
        ),
        grin(146, 7, 1.6, kit.ink),
        eyes(kit, 30, 104, 6)
      ),
  },
  bat: {
    colors: [
      ["#8e7fb8", "#f4c7cf"],
      ["#6f7fa8", "#dcd3f4"],
    ],
    draw: (kit) =>
      figure(
        // Wings, spread from the shoulders, scalloped between their fingers.
        both((side) => [
          path(
            `M${100 + side * 30},160 C${100 + side * 60},130 ${100 + side * 86},118 ${100 + side * 104},124 L${100 + side * 100},200 L${100 + side * 30},200 Z`,
            kit.body
          ),
          faded(0.22, [
            line(`M${100 + side * 40},166 L${100 + side * 98},126`, INK, 3),
            line(`M${100 + side * 44},176 L${100 + side * 86},172`, INK, 3),
          ]),
        ]),
        // Big pointed ears.
        both((side) => [
          blob(
            [100 + side * 18, 70, 100 + side * 56, 12, 100 + side * 62, 90],
            kit.body,
            12
          ),
          blob(
            [100 + side * 32, 70, 100 + side * 54, 32, 100 + side * 54, 82],
            kit.second,
            6
          ),
        ]),
        shoulders(kit.body, 46),
        head(kit.body, 56, 50, 110),
        ellipse(100, 132, 24, 16, kit.second),
        nose(126, 6, 4.4, kit.ink),
        line("M88,134 Q100,142 112,134", kit.ink, 3),
        both((side) =>
          rounded(
            `M${100 + side * 6},138 L${100 + side * 12},138 L${100 + side * 9},146 Z`,
            PEARL,
            2
          )
        ),
        eyes(kit, 25, 108)
      ),
  },
} satisfies Record<string, Design>;

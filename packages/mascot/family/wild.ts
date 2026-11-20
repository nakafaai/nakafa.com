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
  PEARL,
  path,
  rounded,
  shoulders,
  spikes,
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
            [100 + side * 18, 66, 100 + side * 36, 62, 100 + side * 50, 14],
            kit.second,
            10
          ),
          faded(0.25, [
            line(`M${100 + side * 22},56 L${100 + side * 38},52`, INK, 3.4),
            line(`M${100 + side * 27},42 L${100 + side * 41},38`, INK, 3.4),
          ]),
        ]),
        both((side) => [
          ellipse(100 + side * 66, 92, 22, 11, kit.body, side * -16),
          ellipse(100 + side * 66, 93, 13, 5.6, kit.second, side * -16),
        ]),
        shoulders(kit.body, 60),
        // The pale crescent across the throat.
        line("M60,172 Q100,194 140,172", kit.second, 12),
        head(kit.body, 56, 56, 106),
        both((side) => ellipse(100 + side * 38, 124, 8, 6, kit.second)),
        ellipse(100, 140, 32, 22, kit.second),
        ellipse(100, 134, 17, 10, kit.ink),
        both((side) => ellipse(100 + side * 7, 134, 3, 3.4, kit.second)),
        grin(150, 9, 1.6, kit.ink),
        eyes(kit, 27, 100)
      ),
  },
  deer: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#d9a36a", PEARL],
    ],
    draw: (kit) =>
      figure(
        // Antlers, each a beam with two tines.
        both((side) => [
          line(
            `M${100 + side * 20},64 C${100 + side * 24},40 ${100 + side * 38},22 ${100 + side * 54},12`,
            kit.second,
            9
          ),
          line(
            `M${100 + side * 27},40 C${100 + side * 18},28 ${100 + side * 16},18 ${100 + side * 18},8`,
            kit.second,
            8
          ),
          line(
            `M${100 + side * 38},26 C${100 + side * 50},26 ${100 + side * 60},30 ${100 + side * 68},38`,
            kit.second,
            8
          ),
        ]),
        both((side) => [
          ellipse(100 + side * 64, 84, 28, 14, kit.body, side * -24),
          ellipse(100 + side * 64, 85, 18, 7, kit.second, side * -24),
        ]),
        shoulders(kit.body, 58),
        chest(kit.second, 26),
        head(kit.body, 56, 56, 106),
        // The spots of a fawn on the brow.
        both((side) => [
          ellipse(100 + side * 18, 66, 5, 4, kit.second),
          ellipse(100 + side * 34, 76, 4.4, 3.6, kit.second),
        ]),
        ellipse(100, 142, 26, 20, kit.second),
        ellipse(100, 130, 11, 8, kit.ink),
        grin(146, 7, 1.8, kit.ink),
        eyes(kit, 26, 104)
      ),
  },
  giraffe: {
    colors: [
      ["#f7d774", "#c9783a"],
      ["#f3e7a6", "#d9824a"],
    ],
    draw: (kit) =>
      figure(
        // Two ossicones, each topped with a dark knob.
        both((side) => [
          line(`M${100 + side * 18},70 L${100 + side * 24},30`, kit.body, 11),
          ellipse(100 + side * 24, 26, 9, 9, kit.second),
        ]),
        both((side) => [
          ellipse(100 + side * 58, 78, 22, 10, kit.body, side * -20),
          ellipse(100 + side * 58, 79, 12, 5, kit.second, side * -20),
        ]),
        // The long neck, and its patches.
        path(
          "M64,200 C66,170 70,150 76,140 L124,140 C130,150 134,170 136,200 Z",
          kit.body
        ),
        blob([76, 168, 96, 160, 98, 182, 78, 188], kit.second, 6),
        blob([108, 172, 126, 166, 130, 190, 110, 194], kit.second, 6),
        head(kit.body, 50, 56, 102),
        blob([82, 66, 96, 62, 94, 76, 80, 78], kit.second, 5),
        blob([104, 62, 118, 66, 116, 78, 102, 76], kit.second, 5),
        both((side) =>
          blob(
            [100 + side * 40, 98, 100 + side * 48, 88, 100 + side * 50, 104],
            kit.second,
            4
          )
        ),
        ellipse(100, 138, 34, 24, PEARL),
        both((side) => ellipse(100 + side * 12, 134, 3.4, 4.4, kit.ink)),
        grin(146, 9, 1.8, kit.ink),
        eyes(kit, 24, 104)
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
            [100 + side * 24, 64, 100 + side * 44, 18, 100 + side * 52, 70],
            kit.body,
            12
          ),
          blob(
            [100 + side * 32, 62, 100 + side * 44, 32, 100 + side * 46, 64],
            kit.ink,
            5
          ),
        ]),
        // The standing mane, in bands of ink and white.
        spikes(100, 74, 30, 48, 216, 324, 7, kit.ink, 6),
        shoulders(kit.body, 54),
        both((side) =>
          line(
            `M${100 + side * 52},200 C${100 + side * 46},184 ${100 + side * 40},176 ${100 + side * 28},170`,
            kit.ink,
            8
          )
        ),
        path(
          "M100,46 C134,46 152,72 152,104 C152,130 142,166 100,166 C58,166 48,130 48,104 C48,72 66,46 100,46 Z",
          kit.body
        ),
        // Stripes over the brow and down each cheek.
        line("M100,48 L100,74", kit.ink, 8),
        both((side) => [
          line(
            `M${100 + side * 18},52 C${100 + side * 14},62 ${100 + side * 12},70 ${100 + side * 12},78`,
            kit.ink,
            7
          ),
          line(
            `M${100 + side * 50},90 C${100 + side * 40},92 ${100 + side * 34},96 ${100 + side * 30},102`,
            kit.ink,
            7
          ),
          line(
            `M${100 + side * 52},114 C${100 + side * 44},116 ${100 + side * 38},120 ${100 + side * 34},126`,
            kit.ink,
            7
          ),
        ]),
        ellipse(100, 148, 38, 22, kit.ink),
        both((side) => ellipse(100 + side * 14, 144, 4, 5, kit.body)),
        eyes(kit, 25, 104)
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
        hippoEars(kit.body, kit.second),
        shoulders(kit.body, 68),
        // The brow with its two eye bumps, and the wide muzzle under it.
        ellipse(100, 92, 50, 40, kit.body),
        both((side) => ellipse(100 + side * 28, 74, 18, 17, kit.body)),
        ellipse(100, 138, 66, 40, kit.body),
        both((side) => ellipse(100 + side * 50, 146, 12, 8, kit.second)),
        both((side) => ellipse(100 + side * 17, 120, 5, 7, kit.ink)),
        grin(158, 30, 3, kit.ink),
        both((side) =>
          rounded(
            `M${100 + side * 18},163 L${100 + side * 26},163 L${100 + side * 22},172 Z`,
            PEARL,
            2.4
          )
        ),
        eyes(kit, 28, 76, 6.4)
      ),
  },
  rhino: {
    colors: [
      ["#c9d2dc", PEARL],
      ["#b9c0cc", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        // Tube ears, cupped forward.
        both((side) => [
          ellipse(100 + side * 46, 58, 12, 22, kit.body, side * 22),
          ellipse(100 + side * 46, 62, 6, 13, kit.second, side * 22),
        ]),
        shoulders(kit.body, 64),
        head(kit.body, 56, 50, 98),
        // The square upper lip, as wide as the face, under a fold.
        ellipse(100, 142, 46, 28, kit.body),
        faded(0.22, [line("M62,126 Q100,114 138,126", INK, 3.4)]),
        // The great horn on the tip of the nose.
        rounded(
          "M78,140 C80,116 92,96 108,80 C112,74 118,72 118,80 C116,98 116,120 122,140 Z",
          kit.second,
          6
        ),
        both((side) => ellipse(100 + side * 26, 148, 4, 6, kit.ink)),
        grin(160, 12, 1.6, kit.ink),
        eyes(kit, 38, 100, 6)
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
        // The great fan ears.
        both((side) => [
          ellipse(100 + side * 62, 104, 42, 50, kit.body, side * 10),
          ellipse(100 + side * 66, 106, 28, 36, kit.second, side * 10),
        ]),
        shoulders(kit.body, 58),
        head(kit.body, 52, 54, 98),
        // The trunk, curling up at its tip.
        faded(0.2, [
          line(
            "M100,112 C100,140 96,158 104,170 C112,180 126,176 128,164",
            INK,
            30
          ),
        ]),
        line(
          "M100,112 C100,140 96,158 104,170 C112,180 126,176 128,164",
          kit.body,
          24
        ),
        ellipse(129, 160, 9, 6, kit.body, -30),
        faded(0.22, [
          line("M92,136 L108,136", INK, 3),
          line("M92,150 L108,150", INK, 3),
        ]),
        grin(134, 6, 1.6, kit.ink),
        eyes(kit, 26, 100)
      ),
  },
} satisfies Record<string, Design>;

/** Small round ears high on the head, as a hippo has, each with an inner ear. */
function hippoEars(body: string, inner: string) {
  return both((side) => [
    ellipse(100 + side * 46, 58, 13, 12, body),
    ellipse(100 + side * 46, 59, 6.4, 6, inner),
  ]);
}

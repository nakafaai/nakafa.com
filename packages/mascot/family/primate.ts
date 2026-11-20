import type { Design } from "@repo/mascot/kit";
import {
  both,
  ellipse,
  eyes,
  figure,
  grin,
  head,
  kindAt,
  PEARL,
  path,
  roundEars,
  rounded,
  shoulders,
  smile,
  spikes,
} from "@repo/mascot/kit";

/** The pink of the long nose of a proboscis monkey. */
const NOSE = "#ec9a7f";

/** The face of a monkey: two rounds about the eyes over a round muzzle, as one pale shape. */
function face(fill: string, dx: number, y: number, r: number, muzzle: number) {
  return [
    ...both((side) => ellipse(100 + side * dx, y, r, r * 1.04, fill)),
    ellipse(100, y + 28, muzzle, muzzle * 0.8, fill),
  ];
}

/** The great apes and the monkeys of the forests. */
export const primate = {
  orangutan: {
    colors: [
      ["#ee8a4c", "#f6c9a0"],
      ["#d9824a", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        // Shaggy hair standing up from the crown.
        spikes(100, 104, 46, 68, 196, 344, 8, kit.body, 14),
        // Long shaggy arms hang from the shoulders.
        shoulders(kit.body, 70),
        head(kit.body, 58, 54, 108),
        // The wide cheek pads, as one disc behind the face.
        ellipse(100, 118, 50, 36, kit.second),
        face(kit.second, 17, 106, 21, 26),
        both((side) => ellipse(100 + side * 5, 128, 2.6, 3.4, kit.ink)),
        grin(140, 11, 2.4, kit.ink),
        eyes(kit, 17, 106, 6)
      ),
  },
  tarsier: {
    colors: [
      ["#efd2a6", "#f2a33a"],
      ["#c9a27e", "#f7c94f"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, PEARL, 52, 58, 26),
        shoulders(kit.body, 54),
        head(kit.body, 62, 54, 110),
        // Eyes wider than the rest of the face: an amber iris round each pupil.
        both((side) =>
          kindAt(kit.eyes, side) === "open"
            ? [
                ellipse(100 + side * 29, 106, 26, 26, PEARL),
                ellipse(100 + side * 29, 106, 20, 20, kit.second),
              ]
            : []
        ),
        eyes(kit, 29, 106, 11),
        ellipse(100, 136, 7, 4.6, kit.ink),
        grin(144, 6, 1.4, kit.ink, 2.8)
      ),
  },
  monkey: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#c9a27e", "#f6c3a6"],
      ["#8f6a4f", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 62, 104, 22),
        shoulders(kit.body, 58),
        head(kit.body, 58, 56, 106),
        // A tuft of hair on the crown.
        path("M92,52 C92,40 100,34 108,36 C102,40 104,46 110,52 Z", kit.body),
        face(kit.second, 18, 106, 23, 30),
        both((side) => ellipse(100 + side * 6, 128, 2.6, 3.4, kit.ink)),
        smile(138, 11, 7, kit.ink),
        eyes(kit, 18, 106, 6.4)
      ),
  },
  proboscis: {
    colors: [
      ["#d9824a", "#f6c3a6"],
      ["#c9783a", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        shoulders(kit.body, 62),
        head(kit.body, 58, 56, 106),
        // A cap of hair low over the brow.
        path(
          "M44,98 C44,62 70,46 100,46 C130,46 156,62 156,98 C140,82 120,76 100,76 C80,76 60,82 44,98 Z",
          kit.body
        ),
        rounded(
          "M54,108 C56,90 76,84 100,84 C124,84 144,90 146,108 C148,138 128,162 100,162 C72,162 52,138 54,108 Z",
          kit.second,
          4
        ),
        // The long nose that hangs over the mouth.
        rounded(
          "M94,106 C92,122 82,136 84,150 C86,164 114,164 116,150 C118,136 108,122 106,106 Z",
          NOSE,
          6
        ),
        grin(164, 8, 1.4, kit.ink, 2.8),
        eyes(kit, 24, 104, 5.6)
      ),
  },
} satisfies Record<string, Design>;

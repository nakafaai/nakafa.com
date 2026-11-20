import type { Design } from "@repo/mascot/kit";
import {
  belly,
  blob,
  both,
  ellipse,
  eye,
  eyes,
  faded,
  figure,
  head,
  kindAt,
  line,
  nose,
  PEARL,
  roundEars,
  smile,
  torso,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The apes and monkeys, and the tarsier that watches from the trees. */
export const primate = {
  orangutan: {
    colors: [
      ["#ee8a4c", "#f6c9a0"],
      ["#d9824a", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        // Long hair hangs from the shoulders in tufts.
        torso(kit.body, 66),
        both((side) => [
          blob(
            [100 + side * 70, 150, 100 + side * 86, 176, 100 + side * 66, 178],
            kit.body,
            10
          ),
          blob(
            [100 + side * 60, 132, 100 + side * 82, 148, 100 + side * 62, 156],
            kit.body,
            10
          ),
        ]),
        belly(kit.second, 26, 158),
        // The crown, with three loose strands.
        blob([84, 44, 80, 22, 96, 38], kit.body, 9),
        blob([98, 40, 104, 14, 112, 40], kit.body, 9),
        blob([114, 44, 128, 26, 122, 48], kit.body, 9),
        head(kit.body, 52, 56, 84),
        // The cheek pads are one wide disc a tone under the face, and the face sits on it in two rounds.
        ellipse(100, 100, 66, 44, kit.second),
        faded(0.2, [ellipse(100, 100, 66, 44, kit.ink)]),
        ellipse(100, 84, 36, 27, kit.second),
        ellipse(100, 112, 42, 29, kit.second),
        eyes(kit, 15, 84, 6),
        both((side) => ellipse(100 + side * 5, 104, 2, 2.8, kit.ink)),
        line("M78,120 Q100,138 122,120", kit.ink, 3.6)
      ),
  },
  tarsier: {
    colors: [
      ["#efd2a6", "#f2a33a"],
      ["#c9a27e", "#f7c94f"],
    ],
    draw: (kit) =>
      figure(
        // Thin ears, far wider than the head is tall.
        both((side) => [
          ellipse(100 + side * 54, 52, 24, 32, kit.body, side * 28),
          ellipse(100 + side * 55, 54, 14, 22, "#f4c7cf", side * 28),
        ]),
        torso(kit.body, 44),
        belly(PEARL, 22, 156),
        head(kit.body, 60, 52, 98),
        // The eyes are the animal: each iris is wider than its nose and mouth together.
        both((side) => [
          ellipse(100 + side * 29, 92, 28, 28, PEARL),
          ellipse(100 + side * 29, 92, 24, 24, kit.second),
        ]),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 29 + kit.look,
            92,
            13,
            kit.ink
          )
        ),
        nose(126, 4.4, 3.2, kit.ink),
        line("M92,134 Q100,140 108,134", kit.ink, 3),
        // The hands hold on with round finger pads.
        both((side) =>
          Arr.map([-12, 0, 12], (at) =>
            ellipse(
              100 + side * 34 + at,
              180 - Math.abs(at) * 0.3,
              6.4,
              8,
              PEARL
            )
          )
        )
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
        roundEars(kit.body, kit.second, 62, 96, 18),
        torso(kit.body),
        head(kit.body, 56, 52),
        both((side) => ellipse(100 + side * 19, 92, 24, 24, kit.second)),
        ellipse(100, 116, 34, 26, kit.second),
        belly(kit.second),
        eyes(kit, 20, 92),
        both((side) => ellipse(100 + side * 5, 110, 2, 2.6, kit.ink)),
        smile(120, 13, 9, kit.ink)
      ),
  },
  proboscis: {
    colors: [
      ["#d9824a", "#f6c3a6"],
      ["#c9783a", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        blob([90, 52, 92, 36, 102, 48], kit.body, 8),
        blob([102, 50, 110, 32, 114, 52], kit.body, 8),
        roundEars(kit.body, kit.second, 60, 98, 13),
        torso(kit.body, 60),
        head(kit.body, 56, 54, 98),
        both((side) => ellipse(100 + side * 18, 92, 23, 22, kit.second)),
        ellipse(100, 116, 33, 27, kit.second),
        belly(PEARL, 32, 150),
        eyes(kit, 19, 90),
        smile(134, 11, 6, kit.ink),
        ellipse(100, 114, 11, 19, "#e89c7c")
      ),
  },
} satisfies Record<string, Design>;

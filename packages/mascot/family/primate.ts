import {
  belly,
  blob,
  both,
  type Design,
  ellipse,
  eyes,
  figure,
  head,
  nose,
  PEARL,
  roundEars,
  smile,
  torso,
} from "@repo/mascot/kit";

/** The apes and monkeys, and the tarsier that watches from the trees. */
export const primate = {
  orangutan: {
    colors: [
      ["#ee8a4c", "#f6c3a6"],
      ["#d9824a", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        blob([88, 50, 84, 30, 98, 44], kit.body, 8),
        blob([100, 46, 104, 24, 112, 46], kit.body, 8),
        blob([112, 50, 122, 34, 120, 52], kit.body, 8),
        torso(kit.body, 62),
        both((side) => ellipse(100 + side * 44, 102, 28, 38, kit.body)),
        head(kit.body, 46, 52, 98),
        ellipse(100, 104, 40, 44, kit.second),
        belly(kit.second, 30, 152),
        eyes(kit, 15, 92),
        both((side) => ellipse(100 + side * 5, 110, 2, 2.6, kit.ink)),
        smile(120, 14, 10, kit.ink)
      ),
  },
  tarsier: {
    colors: [
      ["#efd2a6", "#f7d774"],
      ["#c9a27e", "#f3e7a6"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 56, 62, 20, 26, kit.body, side * 24),
          ellipse(100 + side * 56, 64, 10, 15, "#f4c7cf", side * 24),
        ]),
        torso(kit.body, 48),
        head(kit.body, 58, 50, 100),
        belly(PEARL, 24, 152),
        both((side) => ellipse(100 + side * 28, 96, 27, 27, kit.second)),
        eyes(kit, 28, 96, 12),
        nose(124, 4, 3, kit.ink),
        smile(130, 6, 5, kit.ink)
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

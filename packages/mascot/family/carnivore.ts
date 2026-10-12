import {
  belly,
  blob,
  both,
  type Design,
  ellipse,
  eye,
  eyes,
  figure,
  head,
  nose,
  path,
  pointEars,
  roundEars,
  smile,
  torso,
  WHITE,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The meat eaters on land, and the seals and walruses that hunt in the sea. */
export const carnivore = {
  kucing: {
    colors: [
      ["#ee8a4c", "#f4e6ce"],
      ["#c9d2dc", "#f6f4ef"],
      ["#efd2a6", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        pointEars(kit.body, kit.second),
        torso(kit.body),
        head(kit.body),
        ellipse(100, 114, 34, 26, kit.second),
        belly(kit.second),
        eyes(kit, 26, 94),
        blob([95, 106, 105, 106, 100, 111], kit.ink, 3),
        smile(116, 9, 8, kit.ink)
      ),
  },
  beruang: {
    colors: [
      ["#c89468", "#f4e6ce"],
      ["#f6f4ef", "#c9d2dc"],
      ["#e8b456", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 46, 52, 19),
        torso(kit.body),
        head(kit.body),
        ellipse(100, 116, 26, 20, kit.second),
        belly(kit.second),
        eyes(kit, 28, 92),
        nose(108, 8, 6, kit.ink),
        smile(118, 8, 7, kit.ink)
      ),
  },
  rubah: {
    colors: [
      ["#ee8a4c", "#f6f4ef"],
      ["#f2a33a", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        pointEars(kit.body, kit.ink),
        torso(kit.body),
        head(kit.body),
        path(
          "M42,104 C60,96 86,104 100,124 C114,104 140,96 158,104 C156,134 132,150 100,150 C68,150 44,134 42,104 Z",
          kit.second
        ),
        belly(kit.second),
        eyes(kit, 28, 92),
        nose(124, 7, 5.4, kit.ink),
        smile(132, 7, 6, kit.ink)
      ),
  },
  panda: {
    colors: [
      ["#f6f4ef", "#f6f4ef"],
      ["#f4e6ce", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.ink, null, 46, 52, 19),
        torso(kit.body),
        both((side) =>
          ellipse(100 + side * 50, 178, 20, 34, kit.ink, side * 16)
        ),
        head(kit.body),
        both((side) =>
          ellipse(100 + side * 27, 98, 15, 19, kit.ink, side * 22)
        ),
        both((side) =>
          eye("titik", 100 + side * 26 + kit.look, 97, 5, kit.body)
        ),
        nose(118, 7, 5, kit.ink),
        smile(126, 8, 7, kit.ink)
      ),
  },
  harimau: {
    colors: [
      ["#f2a33a", "#f4e6ce"],
      ["#ee8a4c", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.ink, 46, 52, 18),
        torso(kit.body),
        head(kit.body),
        blob([100, 50, 96, 66, 104, 66], kit.ink, 4),
        both((side) => [
          blob(
            [100 + side * 22, 54, 100 + side * 18, 66, 100 + side * 26, 66],
            kit.ink,
            3.4
          ),
          blob(
            [100 + side * 58, 96, 100 + side * 44, 100, 100 + side * 56, 104],
            kit.ink,
            3.4
          ),
          blob(
            [100 + side * 56, 114, 100 + side * 44, 116, 100 + side * 52, 122],
            kit.ink,
            3.4
          ),
        ]),
        ellipse(100, 118, 26, 19, kit.second),
        belly(kit.second),
        eyes(kit, 26, 92),
        nose(110, 7, 5, kit.ink),
        smile(119, 8, 7, kit.ink)
      ),
  },
  singa: {
    colors: [
      ["#e8b456", "#c9783a"],
      ["#f7d774", "#ee8a4c"],
    ],
    draw: (kit) =>
      figure(
        Arr.makeBy(12, (index) => {
          const angle = (index / 12) * Math.PI * 2;
          return ellipse(
            100 + Math.cos(angle) * 54,
            98 + Math.sin(angle) * 50,
            22,
            22,
            kit.second
          );
        }),
        ellipse(100, 98, 56, 52, kit.second),
        torso(kit.body, 50),
        roundEars(kit.body, null, 34, 62, 13),
        head(kit.body, 44, 42, 100),
        eyes(kit, 19, 94),
        nose(108, 7, 5, kit.ink),
        smile(117, 8, 7, kit.ink)
      ),
  },
  anjing: {
    colors: [
      ["#efd2a6", "#b98a63"],
      ["#f6f4ef", "#c89468"],
      ["#e8b456", "#a8683a"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body),
        head(kit.body),
        both((side) =>
          ellipse(100 + side * 54, 96, 17, 36, kit.second, side * 8)
        ),
        ellipse(100, 116, 28, 21, WHITE),
        belly(WHITE),
        eyes(kit, 25, 92),
        nose(107, 8.4, 6, kit.ink),
        smile(117, 8, 6, kit.ink),
        ellipse(100, 128, 5.6, 7, "#ec9ab0")
      ),
  },
  musang: {
    colors: [
      ["#b9c0cc", "#f6f4ef"],
      ["#c9a27e", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.ink, 46, 54, 16),
        torso(kit.body),
        head(kit.body),
        ellipse(100, 66, 6, 16, kit.second),
        both((side) =>
          ellipse(100 + side * 28, 96, 23, 15, kit.ink, side * 18)
        ),
        both((side) =>
          eye("titik", 100 + side * 26 + kit.look, 96, 5, kit.second)
        ),
        ellipse(100, 120, 22, 17, kit.second),
        belly(kit.second),
        nose(114, 6.4, 4.8, kit.ink),
        smile(123, 7, 6, kit.ink)
      ),
  },
  rakun: {
    colors: [
      ["#9aa3b0", "#f6f4ef"],
      ["#b8a58c", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.ink, 46, 54, 17),
        torso(kit.body),
        head(kit.body),
        ellipse(100, 118, 27, 21, kit.second),
        ellipse(100, 70, 8, 16, kit.second),
        both((side) =>
          ellipse(100 + side * 27, 96, 23, 15, kit.ink, side * 18)
        ),
        belly(kit.second),
        eyes(kit, 26, 96, 5, WHITE),
        nose(110, 6, 4.6, kit.ink),
        smile(120, 8, 6, kit.ink)
      ),
  },
  "anjing-laut": {
    colors: [
      ["#c9d2dc", "#f6f4ef"],
      ["#cfe6f7", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 62),
        head(kit.body, 58, 54, 96),
        both((side) => ellipse(100 + side * 13, 116, 17, 15, kit.second)),
        belly(kit.second, 34, 150),
        both((side) => [
          ellipse(100 + side * 10, 114, 1.7, 1.7, kit.ink),
          ellipse(100 + side * 17, 118, 1.7, 1.7, kit.ink),
          ellipse(100 + side * 20, 111, 1.7, 1.7, kit.ink),
        ]),
        eyes(kit, 28, 90),
        nose(105, 7, 5, kit.ink)
      ),
  },
  walrus: {
    colors: [
      ["#b08968", "#f4e6ce"],
      ["#a8876f", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        both((side) =>
          ellipse(100 + side * 58, 178, 18, 32, kit.body, side * -16)
        ),
        torso(kit.body, 62),
        head(kit.body, 58, 52, 96),
        both((side) =>
          blob(
            [100 + side * 11, 132, 100 + side * 21, 132, 100 + side * 15, 170],
            WHITE,
            7
          )
        ),
        both((side) => [
          ellipse(100 + side * 20, 118, 25, 21, kit.second),
          ellipse(100 + side * 13, 114, 2.1, 2.1, kit.ink),
          ellipse(100 + side * 25, 111, 2.1, 2.1, kit.ink),
          ellipse(100 + side * 21, 122, 2.1, 2.1, kit.ink),
        ]),
        eyes(kit, 27, 86, 5.6),
        nose(104, 8.4, 5.6, kit.ink)
      ),
  },
} satisfies Record<string, Design>;

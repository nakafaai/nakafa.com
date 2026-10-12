import {
  belly,
  blob,
  both,
  type Design,
  ellipse,
  eye,
  eyes,
  faded,
  figure,
  head,
  kindAt,
  line,
  path,
  smile,
  torso,
  WHITE,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The reptiles, and the amphibians that live beside them. */
export const reptile = {
  komodo: {
    colors: [
      ["#b4bc84", "#ec9ab0"],
      ["#9fb07a", "#f5a48e"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 58),
        head(kit.body, 66, 44, 104),
        line(
          "M100,128 L100,146 M100,146 L92,158 M100,146 L108,158",
          kit.second,
          6
        ),
        faded(0.22, [
          ...both((side) => [
            ellipse(100 + side * 14, 60, 5, 4, kit.ink),
            ellipse(100 + side * 30, 68, 4, 3.4, kit.ink),
          ]),
          ellipse(100, 56, 5, 4, kit.ink),
        ]),
        eyes(kit, 36, 96),
        both((side) => ellipse(100 + side * 8, 112, 2.4, 2.4, kit.ink)),
        line("M70,126 Q100,136 130,126", kit.ink, 4.4)
      ),
  },
  buaya: {
    colors: [
      ["#6fae6a", "#ddebb5"],
      ["#5e9c7c", "#cfebd9"],
    ],
    draw: (kit) =>
      figure(
        both((side) => ellipse(100 + side * 26, 58, 19, 19, kit.body)),
        torso(kit.body, 58),
        belly(kit.second, 34, 166),
        head(kit.body, 46, 34, 80),
        path(
          "M62,84 C62,70 138,70 138,84 C140,104 152,118 152,132 C152,150 126,158 100,158 C74,158 48,150 48,132 C48,118 60,104 62,84 Z",
          kit.body
        ),
        ellipse(100, 84, 4, 4, kit.second),
        ellipse(100, 98, 3.4, 3.4, kit.second),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 26 + kit.look,
            58,
            5.8,
            kit.ink
          )
        ),
        both((side) => ellipse(100 + side * 12, 118, 3.2, 4, kit.ink)),
        Arr.map(
          [
            [-40, 139],
            [-26, 143],
            [-12, 145],
            [12, 145],
            [26, 143],
            [40, 139],
          ],
          ([x, y]) =>
            blob(
              [100 + x - 4.5, y, 100 + x + 4.5, y, 100 + x, y + 9],
              WHITE,
              2.4
            )
        ),
        line("M50,134 Q100,150 150,134", kit.ink, 4.6)
      ),
  },
  ular: {
    colors: [
      ["#7fc7a0", "#f7d774"],
      ["#f2a33a", "#f4e6ce"],
      ["#8e9ad6", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        ellipse(100, 190, 72, 28, kit.body),
        line("M48,190 Q100,212 152,190", kit.second, 6.4),
        ellipse(100, 158, 54, 23, kit.body),
        line("M60,158 Q100,176 140,158", kit.second, 6.4),
        ellipse(100, 126, 22, 36, kit.body),
        ellipse(100, 88, 42, 35, kit.body),
        ellipse(100, 64, 5.4, 4.4, kit.second),
        both((side) => ellipse(100 + side * 24, 70, 4.4, 3.6, kit.second)),
        line("M100,107 V125 M100,125 L92,135 M100,125 L108,135", "#ee6a5a", 4),
        eyes(kit, 19, 84, 5.6),
        line("M84,102 Q100,113 116,102", kit.ink, 4.2)
      ),
  },
  katak: {
    colors: [
      ["#98cf82", "#ddebb5"],
      ["#7fc7a0", "#cfebd9"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 32, 58, 25, 25, kit.body),
          ellipse(100 + side * 32, 58, 15, 15, kit.second),
        ]),
        torso(kit.body, 62),
        head(kit.body, 68, 46, 106),
        belly(kit.second, 38, 140),
        both((side) =>
          eye(kindAt(kit.eyes, side), 100 + side * 32, 58, 6.6, kit.ink)
        ),
        smile(112, 30, 16, kit.ink)
      ),
  },
  axolotl: {
    colors: [
      ["#f4c7cf", "#ec9ab0"],
      ["#dcd3f4", "#aeb8f5"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 66, 66, 20, 8, kit.second, side * -36),
          ellipse(100 + side * 72, 92, 20, 8, kit.second, side * -8),
          ellipse(100 + side * 68, 118, 20, 8, kit.second, side * 22),
        ]),
        torso(kit.body),
        head(kit.body, 62, 48, 100),
        eyes(kit, 34, 96),
        smile(108, 20, 12, kit.ink)
      ),
  },
} satisfies Record<string, Design>;

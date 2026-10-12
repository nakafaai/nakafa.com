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
  path,
  spikes,
  torso,
  WHITE,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The birds, from the farmyard to the forest canopy. */
export const bird = {
  ayam: {
    colors: [
      ["#f7d774", "#ee8a4c"],
      ["#f3e7a6", "#f2a33a"],
    ],
    draw: (kit) =>
      figure(
        ellipse(90, 44, 8, 13, kit.body, -24),
        ellipse(100, 40, 8, 15, kit.body),
        ellipse(110, 44, 8, 13, kit.body, 24),
        torso(kit.body, 60),
        head(kit.body, 58, 54, 100),
        both((side) => ellipse(100 + side * 40, 114, 9, 6, kit.second)),
        eyes(kit, 24, 94),
        blob([90, 106, 110, 106, 100, 117], kit.second, 6)
      ),
  },
  "burung-hantu": {
    colors: [
      ["#c9a27e", "#f4e6ce"],
      ["#c9d2dc", "#f6f4ef"],
      ["#aeb8f5", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        both((side) =>
          blob(
            [100 + side * 56, 78, 100 + side * 58, 40, 100 + side * 28, 54],
            kit.body,
            10
          )
        ),
        torso(kit.body),
        head(kit.body),
        belly(kit.second, 32, 144),
        both((side) => ellipse(100 + side * 26, 94, 25, 25, kit.second)),
        eyes(kit, 26, 94, 7.4),
        blob([94, 108, 106, 108, 100, 118], kit.ink, 4)
      ),
  },
  penguin: {
    colors: [
      ["#5b6b8c", "#f6f4ef"],
      ["#7c8fc4", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 60),
        head(kit.body),
        both((side) => ellipse(100 + side * 20, 102, 28, 30, kit.second)),
        path(
          "M62,200 C60,170 70,128 100,120 C130,128 140,170 138,200 Z",
          kit.second
        ),
        eyes(kit, 22, 98),
        blob([92, 110, 108, 110, 100, 120], "#ee8a4c", 5)
      ),
  },
  bebek: {
    colors: [
      ["#f6f4ef", "#f2a33a"],
      ["#f7d774", "#ee8a4c"],
      ["#9fd6b8", "#f2a33a"],
    ],
    draw: (kit) =>
      figure(
        line("M100,46 Q96,28 110,26", kit.body, 8),
        torso(kit.body, 58),
        head(kit.body, 56, 52, 98),
        ellipse(100, 114, 27, 13, kit.second),
        line("M80,114 Q100,121 120,114", kit.ink, 3.4),
        eyes(kit, 24, 90)
      ),
  },
  kakatua: {
    colors: [
      ["#f6f4ef", "#f7d774"],
      ["#f4c7cf", "#ec9ab0"],
    ],
    draw: (kit) =>
      figure(
        ellipse(78, 44, 8, 26, kit.second, -30),
        ellipse(92, 34, 8, 28, kit.second, -10),
        ellipse(108, 34, 8, 28, kit.second, 10),
        ellipse(122, 44, 8, 26, kit.second, 30),
        torso(kit.body, 58),
        head(kit.body, 56, 52, 100),
        both((side) => ellipse(100 + side * 40, 112, 9, 7, kit.second)),
        eyes(kit, 25, 94),
        path(
          "M86,104 C90,98 110,98 114,104 C113,118 106,128 100,130 C94,128 87,118 86,104 Z",
          "#5b6b8c"
        )
      ),
  },
  rangkong: {
    colors: [
      ["#5b6b8c", "#f6f4ef"],
      ["#6d4b78", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 58),
        head(kit.body, 56, 52, 96),
        ellipse(100, 98, 42, 36, kit.second),
        belly(kit.second, 30, 152),
        eyes(kit, 28, 90),
        path(
          "M80,104 C84,96 116,96 120,104 C119,130 108,152 100,156 C92,152 81,130 80,104 Z",
          "#f2a33a"
        ),
        path("M86,98 C88,80 112,80 114,98 Z", "#ee8a4c")
      ),
  },
  elang: {
    colors: [
      ["#8f6a4f", "#f6f4ef"],
      ["#a8794f", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 62),
        spikes(100, 110, 44, 62, 20, 160, 7, kit.second, 6),
        head(kit.second, 54, 50, 98),
        both((side) =>
          line(`M${100 + side * 38},76 L${100 + side * 15},84`, kit.ink, 4.6)
        ),
        eyes(kit, 25, 96),
        blob([90, 106, 110, 106, 100, 126], "#f7d774", 7)
      ),
  },
  nuri: {
    colors: [
      ["#ee6a5a", "#f7d774"],
      ["#7fc7a0", "#f7d774"],
      ["#6fb1e8", "#f7d774"],
    ],
    draw: (kit) =>
      figure(
        ellipse(100, 42, 9, 14, kit.body),
        ellipse(88, 46, 7, 11, kit.body, -24),
        ellipse(112, 46, 7, 11, kit.body, 24),
        torso(kit.body, 58),
        head(kit.body, 56, 52, 98),
        belly(kit.second, 30, 152),
        both((side) => ellipse(100 + side * 27, 92, 20, 20, WHITE)),
        eyes(kit, 27, 92),
        path(
          "M86,102 C90,94 110,94 114,102 C113,120 106,132 100,134 C94,132 87,120 86,102 Z",
          kit.second
        )
      ),
  },
  flamingo: {
    colors: [
      ["#f48fb1", "#f6f4ef"],
      ["#f7a8a0", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        both((side) =>
          ellipse(100 + side * 40, 184, 28, 38, kit.body, side * -14)
        ),
        torso(kit.body, 40),
        ellipse(100, 150, 21, 58, kit.body),
        head(kit.body, 44, 42, 84),
        eyes(kit, 23, 78, 5.4),
        path(
          "M85,92 C90,84 110,84 115,92 C115,112 108,130 100,134 C92,130 85,112 85,92 Z",
          kit.second
        ),
        path(
          "M89,114 C96,119 104,119 111,114 C109,125 104,131 100,134 C96,131 91,125 89,114 Z",
          kit.ink
        )
      ),
  },
  merak: {
    colors: [
      ["#3f7fc4", "#7fc7a0"],
      ["#2f9a8f", "#f7d774"],
    ],
    draw: (kit) =>
      figure(
        Arr.flatMap(Arr.range(0, 6), (index) => {
          const degrees = -164 + (index * 148) / 6;
          const angle = (degrees * Math.PI) / 180;
          const x = 100 + 84 * Math.cos(angle);
          const y = 152 + 84 * Math.sin(angle);
          return [
            ellipse(x, y, 20, 32, kit.second, degrees + 90),
            ellipse(x, y, 10, 12, kit.body),
            ellipse(x, y, 4.4, 5.4, "#f7d774"),
          ];
        }),
        Arr.flatMap([-1, 0, 1], (offset) => [
          line(
            `M${100 + offset * 9},64 L${100 + offset * 15},44`,
            kit.body,
            3.4
          ),
          ellipse(100 + offset * 15, 42, 4.4, 4.4, kit.body),
        ]),
        torso(kit.body, 40),
        head(kit.body, 40, 38, 98),
        eyes(kit, 18, 94, 5.2),
        blob([94, 106, 106, 106, 100, 117], "#f7d774", 4)
      ),
  },
  kasuari: {
    colors: [
      ["#2f3a56", "#3f8fd0"],
      ["#34344a", "#4aa3c7"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 62),
        ellipse(100, 150, 24, 52, kit.second),
        both((side) => ellipse(100 + side * 8, 152, 6.4, 15, "#ee6a5a")),
        blob([88, 60, 100, 20, 112, 60], "#c9a27e", 10),
        head(kit.second, 42, 44, 96),
        eyes(kit, 18, 90, 5.4),
        blob([92, 104, 108, 104, 100, 123], "#3b4252", 5)
      ),
  },
} satisfies Record<string, Design>;

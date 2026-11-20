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
  PEARL,
  path,
  spikes,
  torso,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The birds, from the farmyard to the forest canopy. */
export const bird = {
  chicken: {
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
  owl: {
    colors: [
      ["#c9a27e", "#f4e6ce"],
      ["#c9d2dc", PEARL],
      ["#aeb8f5", PEARL],
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
      ["#5b6b8c", PEARL],
      ["#7c8fc4", PEARL],
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
  duck: {
    colors: [
      [PEARL, "#f2a33a"],
      ["#f7d774", "#ee8a4c"],
      ["#9fd6b8", "#f2a33a"],
    ],
    draw: (kit) =>
      figure(
        // Two curled feathers at the crown.
        line("M98,50 C92,34 100,22 112,24", kit.body, 9),
        line("M106,50 C108,38 118,34 126,40", kit.body, 7),
        // The folded wings, a tone under the body.
        both((side) => [
          ellipse(100 + side * 50, 172, 20, 34, kit.body, side * 14),
          faded(0.12, [
            ellipse(100 + side * 50, 172, 20, 34, kit.ink, side * 14),
          ]),
        ]),
        torso(kit.body, 46),
        faded(0.6, [belly(PEARL, 26, 150)]),
        head(kit.body, 52, 50, 92),
        // The bill: the wide upper half, and the lower half under its line.
        path(
          "M66,112 C66,96 82,96 100,100 C118,96 134,96 134,112 C134,126 120,134 100,134 C80,134 66,126 66,112 Z",
          kit.second
        ),
        faded(0.16, [
          path(
            "M70,118 C84,124 116,124 130,118 C126,128 116,134 100,134 C84,134 74,128 70,118 Z",
            kit.ink
          ),
        ]),
        both((side) => ellipse(100 + side * 8, 108, 2, 2.6, kit.ink)),
        eyes(kit, 24, 82)
      ),
  },
  cockatoo: {
    colors: [
      [PEARL, "#f7d774"],
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
  hornbill: {
    colors: [
      ["#5b6b8c", PEARL],
      ["#6d4b78", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        torso(kit.body, 54),
        belly(kit.second, 30, 150),
        head(kit.body, 52, 50, 100),
        // The bare ring around each eye, so the eyes read on the dark head.
        both((side) =>
          ellipse(100 + side * 30 + kit.look, 96, 15, 16, kit.second)
        ),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 30 + kit.look,
            96,
            6.4,
            kit.ink
          )
        ),
        // The casque rides on the bill and turns up at its tip.
        path(
          "M82,96 C78,66 86,42 108,34 C120,30 130,34 132,42 C122,42 116,50 116,62 C118,76 118,88 118,96 Z",
          "#ee8a4c"
        ),
        // The bill, wide at the face and bending down to its point.
        path(
          "M76,96 C84,88 116,88 124,96 C126,128 116,160 100,174 C84,160 74,128 76,96 Z",
          "#f7c94f"
        ),
        faded(0.5, [
          path(
            "M84,100 C90,96 104,96 108,100 C108,122 104,142 100,154 C92,140 84,122 84,100 Z",
            PEARL
          ),
        ]),
        line("M78,112 Q100,120 122,112", "#ee8a4c", 3)
      ),
  },
  eagle: {
    colors: [
      ["#8f6a4f", PEARL],
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
  parrot: {
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
        both((side) => ellipse(100 + side * 27, 92, 20, 20, PEARL)),
        eyes(kit, 27, 92),
        path(
          "M86,102 C90,94 110,94 114,102 C113,120 106,132 100,134 C94,132 87,120 86,102 Z",
          kit.second
        )
      ),
  },
  flamingo: {
    colors: [
      ["#f48fb1", PEARL],
      ["#f7a8a0", PEARL],
    ],
    draw: (kit) =>
      figure(
        // The folded wing, a tone under the body, behind the neck.
        ellipse(124, 190, 58, 36, kit.body, -8),
        faded(0.14, [
          path(
            "M92,176 C116,160 158,164 176,186 C150,180 118,182 92,176 Z",
            kit.ink
          ),
          path(
            "M100,192 C122,180 154,182 170,198 C146,196 122,196 100,192 Z",
            kit.ink
          ),
        ]),
        // The long neck bends in an S up to the head.
        line("M112,196 C150,168 62,152 92,104", kit.body, 26),
        ellipse(92, 82, 40, 38, kit.body),
        eyes(kit, 21, 74, 5.4),
        // The bill is bent in the middle, and its tip is dark.
        path(
          "M76,88 C84,80 104,80 110,90 C116,104 114,118 104,130 C98,136 90,134 88,126 C92,114 82,104 76,88 Z",
          kit.second
        ),
        path(
          "M96,110 C104,114 110,110 113,104 C114,114 110,124 104,130 C98,136 90,134 88,126 C92,122 95,116 96,110 Z",
          kit.ink
        )
      ),
  },
  peacock: {
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
  cassowary: {
    colors: [
      ["#2f3a56", "#3f8fd0"],
      ["#34344a", "#4aa3c7"],
    ],
    draw: (kit) =>
      figure(
        // The shaggy black body, its feathers ending in tufts.
        path(
          "M22,200 C22,160 56,134 100,134 C144,134 178,160 178,200 Z",
          kit.body
        ),
        both((side) => [
          blob(
            [100 + side * 58, 150, 100 + side * 84, 152, 100 + side * 74, 172],
            kit.body,
            8
          ),
          blob(
            [100 + side * 70, 166, 100 + side * 92, 176, 100 + side * 78, 190],
            kit.body,
            8
          ),
        ]),
        // The bare blue neck, and the two red wattles at its front.
        path(
          "M78,200 C78,170 80,140 84,116 L116,116 C120,140 122,170 122,200 Z",
          kit.second
        ),
        both((side) =>
          ellipse(100 + side * 8, 150, 7, 17, "#ee6a5a", side * -6)
        ),
        // The casque, a tall blade over the brow.
        path("M84,66 C82,40 92,18 106,12 C116,24 120,46 116,66 Z", "#c9a27e"),
        faded(0.16, [
          path(
            "M84,66 C83,58 84,50 86,42 C96,48 106,48 118,42 C119,50 118,58 116,66 Z",
            kit.ink
          ),
        ]),
        head(kit.second, 42, 42, 92),
        eyes(kit, 18, 86, 5.4),
        blob([91, 100, 109, 100, 100, 122], "#3b4252", 6),
        faded(0.35, [line("M94,104 L106,104", PEARL, 2.4)])
      ),
  },
} satisfies Record<string, Design>;

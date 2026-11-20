import type { Design } from "@repo/mascot/kit";
import {
  both,
  ellipse,
  eye,
  eyes,
  faded,
  figure,
  head,
  INK,
  kindAt,
  line,
  PEARL,
  path,
  rounded,
  smile,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** Two antennae curling out from the top of a head, each with a knob. */
function antennae(color: string, dx: number, top: number) {
  return both((side) => [
    line(
      `M${100 + side * 12},66 C${100 + side * 16},44 ${100 + side * (dx - 6)},${top + 10} ${100 + side * dx},${top}`,
      color,
      5
    ),
    ellipse(100 + side * dx, top, 7, 7, color),
  ]);
}

/** The small creatures: the ones that buzz, flutter, crawl, and spin. */
export const bug = {
  bee: {
    colors: [
      ["#f7d774", "#cfe6f7"],
      ["#e8b456", PEARL],
    ],
    draw: (kit) =>
      figure(
        // Wings, raised behind the shoulders.
        both((side) => [
          ellipse(100 + side * 58, 70, 30, 40, kit.second, side * 30),
        ]),
        antennae(INK, 34, 20),
        // A fuzzy round body in bands.
        ellipse(100, 120, 72, 76, kit.body),
        path(
          "M30,150 C60,160 140,160 170,150 C168,162 164,172 158,180 C130,188 70,188 42,180 C36,172 32,162 30,150 Z",
          INK
        ),
        path("M54,196 C80,202 120,202 146,196 L140,212 L60,212 Z", INK),
        both((side) => ellipse(100 + side * 46, 128, 10, 6, "#f4a3a8")),
        smile(128, 10, 6, kit.ink),
        eyes(kit, 28, 108, 8)
      ),
  },
  beetle: {
    colors: [
      ["#ee6a5a", "#f4e6ce"],
      ["#f2a33a", PEARL],
    ],
    draw: (kit) =>
      figure(
        antennae(INK, 34, 26),
        // The shell, two wing cases with spots, parted down the middle.
        ellipse(100, 168, 82, 70, kit.body),
        line("M100,120 L100,240", INK, 4),
        both((side) => [
          ellipse(100 + side * 34, 150, 13, 13, INK),
          ellipse(100 + side * 58, 186, 11, 11, INK),
          ellipse(100 + side * 22, 196, 10, 10, INK),
        ]),
        // The dark head, with pale cheeks and a pale smile.
        head(INK, 50, 44, 100),
        smile(116, 9, 6, kit.second),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 22 + kit.look,
            96,
            7.4,
            kit.second
          )
        )
      ),
  },
  dragonfly: {
    colors: [
      ["#5fbfa8", "#cfe6f7"],
      ["#6fb1e8", "#dcd3f4"],
      ["#ee6a5a", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        // Four long wings, spread level.
        both((side) => [
          ellipse(100 + side * 58, 118, 52, 16, kit.second, side * -12),
          ellipse(100 + side * 56, 146, 46, 14, kit.second, side * 14),
          faded(0.2, [
            line(`M${100 + side * 20},122 L${100 + side * 104},104`, INK, 2.4),
            line(`M${100 + side * 20},144 L${100 + side * 96},162`, INK, 2.4),
          ]),
        ]),
        // The long body in segments, down to the bottom edge.
        Arr.map([150, 170, 190, 210], (y) => ellipse(100, y, 14, 12, kit.body)),
        ellipse(100, 132, 22, 20, kit.body),
        // A round head with great eyes that wrap round it.
        ellipse(100, 88, 46, 38, kit.body),
        both((side) => ellipse(100 + side * 26, 80, 26, 26, kit.body)),
        both((side) => ellipse(100 + side * 26, 80, 19, 19, PEARL)),
        smile(108, 8, 5, kit.ink),
        eyes(kit, 26, 80, 10)
      ),
  },
  butterfly: {
    colors: [
      ["#f2a33a", "#f7d774"],
      ["#8e9ad6", "#dcd3f4"],
      ["#ee6a5a", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        // Four wings: big ones above, small ones below, each with its spots.
        both((side) => [
          rounded(
            `M${100 + side * 10},120 C${100 + side * 20},64 ${100 + side * 60},28 ${100 + side * 90},40 C${100 + side * 108},50 ${100 + side * 100},102 ${100 + side * 62},128 Z`,
            kit.body,
            8
          ),
          rounded(
            `M${100 + side * 10},130 C${100 + side * 40},128 ${100 + side * 84},134 ${100 + side * 86},170 C${100 + side * 86},196 ${100 + side * 50},198 ${100 + side * 28},178 Z`,
            kit.body,
            8
          ),
          ellipse(100 + side * 64, 76, 18, 20, kit.second),
          ellipse(100 + side * 54, 166, 13, 13, kit.second),
          ellipse(100 + side * 82, 56, 6, 6, PEARL),
        ]),
        antennae(INK, 28, 30),
        // The slender body and its round head.
        ellipse(100, 150, 12, 50, INK),
        head(INK, 30, 28, 96),
        smile(106, 6, 4, PEARL),
        both((side) =>
          eye(kindAt(kit.eyes, side), 100 + side * 13 + kit.look, 92, 5, PEARL)
        )
      ),
  },
  spider: {
    colors: [
      ["#6d5aa8", "#dcd3f4"],
      ["#4b6a8f", "#cfe6f7"],
      ["#8c5a4f", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        // The thread it hangs from.
        line("M100,-10 L100,60", PEARL, 3),
        // Eight legs, each bent at the knee.
        both((side) =>
          Arr.map([0, 1, 2, 3], (index) => {
            const y = 96 + index * 22;
            const knee = 100 + side * (74 + (index % 2) * 6);
            return line(
              `M${100 + side * 40},${y} L${knee},${y - 30 + index * 8} L${100 + side * (96 + index * 2)},${y + 14 + index * 10}`,
              kit.body,
              10
            );
          })
        ),
        // The round abdomen, marked, below a round head.
        ellipse(100, 168, 52, 46, kit.body),
        rounded("M100,148 L114,166 L100,186 L86,166 Z", kit.second, 6),
        ellipse(100, 106, 52, 46, kit.body),
        both((side) => ellipse(100 + side * 14, 80, 4.4, 4.4, kit.second)),
        smile(124, 9, 5, kit.second),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 22 + kit.look,
            104,
            9,
            kit.second
          )
        )
      ),
  },
  snail: {
    colors: [
      ["#f6c3a6", "#b98a63"],
      ["#f3e7a6", "#c9783a"],
      ["#cfebd9", "#5e8f9c"],
    ],
    draw: (kit) =>
      figure(
        // The soft foot along the bottom.
        rounded(
          "M8,200 C10,178 30,168 60,168 L180,168 C196,170 204,186 204,200 Z",
          kit.body,
          6
        ),
        // The shell, a spiral on its back.
        ellipse(124, 120, 62, 60, kit.second),
        line(
          "M126,122 C126,110 140,108 144,118 C150,132 134,146 118,140 C98,132 100,104 120,96 C144,86 168,104 166,130 C164,156 138,172 112,164",
          "#f4e6ce",
          8
        ),
        // The head, raised on its neck, and the eyes on their stalks.
        path(
          "M28,200 C26,170 30,140 40,118 C50,100 76,100 80,122 C84,146 82,176 86,200 Z",
          kit.body
        ),
        both((side) =>
          line(`M${56 + side * 8},106 L${56 + side * 14},64`, kit.body, 8)
        ),
        both((side) => ellipse(56 + side * 14, 62, 11, 11, kit.body)),
        line("M46,140 Q56,148 66,140", kit.ink, 3.4),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            56 + side * 14 + kit.look,
            62,
            6.4,
            kit.ink
          )
        )
      ),
  },
} satisfies Record<string, Design>;

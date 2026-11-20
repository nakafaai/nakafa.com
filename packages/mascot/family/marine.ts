import type { Design } from "@repo/mascot/kit";
import {
  blob,
  both,
  ellipse,
  eye,
  eyes,
  faded,
  figure,
  grin,
  head,
  INK,
  kindAt,
  line,
  PEARL,
  path,
  rounded,
  smile,
  spikes,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The points of a five-armed star about its centre, its arms `outer` long and its waist `inner`. */
function star(cx: number, cy: number, outer: number, inner: number) {
  return Arr.flatMap(Arr.range(0, 9), (index) => {
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    const reach = index % 2 === 0 ? outer : inner;
    return [cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach];
  });
}

/** The animals of the sea, from the reef to the open ocean. */
export const marine = {
  whale: {
    colors: [
      ["#aeb8f5", "#eef1fd"],
      ["#8fb7e8", PEARL],
    ],
    draw: (kit) =>
      figure(
        // The spout, two curls of water over the blowhole.
        both((side) =>
          line(
            `M100,58 C${100 + side * 2},40 ${100 + side * 18},30 ${100 + side * 30},38`,
            kit.second,
            8
          )
        ),
        // The tail flukes, raised behind one side.
        rounded(
          "M150,140 C162,118 176,104 196,100 C190,116 186,128 186,140 C194,146 198,156 196,166 C182,160 166,156 150,160 Z",
          kit.body,
          6
        ),
        path(
          "M28,200 C22,140 46,64 100,64 C154,64 178,140 172,200 Z",
          kit.body
        ),
        // The pale throat, ridged.
        path(
          "M50,200 C50,166 72,148 100,148 C128,148 150,166 150,200 Z",
          kit.second
        ),
        faded(0.16, [
          line("M76,168 L76,200", INK, 3),
          line("M100,160 L100,200", INK, 3),
          line("M124,168 L124,200", INK, 3),
        ]),
        both((side) =>
          ellipse(100 + side * 52, 166, 14, 26, kit.body, side * -40)
        ),
        grin(130, 18, 3, kit.ink),
        eyes(kit, 34, 112, 7)
      ),
  },
  turtle: {
    colors: [
      ["#98cf82", "#e8b456"],
      ["#7fc7a0", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        // Flippers, out to the sides.
        both((side) =>
          ellipse(100 + side * 74, 172, 16, 32, kit.body, side * 56)
        ),
        // The shell: a rim, and plates on its dome.
        ellipse(100, 206, 92, 66, "#8a6a3a"),
        ellipse(100, 206, 84, 60, kit.second),
        faded(0.25, [
          line("M60,160 L76,176 L124,176 L140,160", INK, 3.4),
          line("M76,176 L72,200 M124,176 L128,200 M100,146 L100,176", INK, 3.4),
        ]),
        // The head on its neck, peeking out from the shell.
        path(
          "M76,160 C76,140 80,128 84,120 L116,120 C120,128 124,140 124,160 Z",
          kit.body
        ),
        head(kit.body, 52, 46, 98),
        smile(116, 12, 6, kit.ink),
        eyes(kit, 24, 94)
      ),
  },
  octopus: {
    colors: [
      ["#f5a48e", "#fbe3d4"],
      ["#dcd3f4", "#a999e6"],
      ["#ec9ab0", "#fde4ea"],
    ],
    draw: (kit) =>
      figure(
        // Arms curling out from under the mantle, suckers on their undersides.
        Arr.flatMap([-1, 1], (side) => [
          line(
            `M${100 + side * 30},150 C${100 + side * 44},176 ${100 + side * 74},180 ${100 + side * 86},160 C${100 + side * 94},146 ${100 + side * 82},136 ${100 + side * 74},146`,
            kit.body,
            20
          ),
          line(
            `M${100 + side * 12},160 C${100 + side * 14},184 ${100 + side * 30},200 ${100 + side * 46},206`,
            kit.body,
            20
          ),
          ellipse(100 + side * 62, 178, 4, 4, kit.second),
          ellipse(100 + side * 80, 166, 4, 4, kit.second),
          ellipse(100 + side * 20, 186, 4, 4, kit.second),
        ]),
        // The great dome of the mantle.
        path(
          "M38,112 C38,62 64,36 100,36 C136,36 162,62 162,112 C162,146 138,168 100,168 C62,168 38,146 38,112 Z",
          kit.body
        ),
        both((side) => [
          ellipse(100 + side * 34, 62, 8, 6, kit.second, side * -30),
          ellipse(100 + side * 46, 80, 5, 4, kit.second, side * -30),
        ]),
        smile(134, 10, 6, kit.ink),
        eyes(kit, 28, 112, 7.4)
      ),
  },
  jellyfish: {
    colors: [
      ["#dcd3f4", PEARL],
      ["#f4c7cf", PEARL],
      ["#cfe6f7", PEARL],
    ],
    draw: (kit) =>
      figure(
        // Tentacles, waving under the bell.
        Arr.map([-36, -12, 12, 36], (x, index) =>
          line(
            `M${100 + x},140 C${100 + x - 10},158 ${100 + x + 10},172 ${100 + x},188 C${100 + x - 8},198 ${100 + x + 4},206 ${100 + x},212`,
            index % 2 === 0 ? kit.body : kit.second,
            9
          )
        ),
        // The bell, scalloped along its rim.
        path(
          "M30,124 C30,72 62,40 100,40 C138,40 170,72 170,124 C162,138 150,138 142,130 C134,140 122,140 114,132 C106,142 94,142 86,132 C78,140 66,140 58,130 C50,138 38,138 30,124 Z",
          kit.body
        ),
        path("M56,80 C66,60 86,52 100,52 C88,58 72,70 66,88 Z", kit.second),
        ellipse(132, 72, 6, 6, kit.second),
        smile(110, 9, 5, kit.ink),
        eyes(kit, 26, 96)
      ),
  },
  pufferfish: {
    colors: [
      ["#f3e7a6", PEARL],
      ["#8fd0c4", PEARL],
      ["#f6c3a6", PEARL],
    ],
    draw: (kit) =>
      figure(
        // Spines all round the puffed-up ball.
        spikes(100, 116, 64, 84, 0, 345, 24, kit.body, 4),
        faded(0.25, spikes(100, 116, 66, 80, 0, 345, 24, INK, 2)),
        both((side) =>
          rounded(
            `M${100 + side * 66},112 C${100 + side * 84},96 ${100 + side * 96},104 ${100 + side * 92},118 C${100 + side * 96},132 ${100 + side * 84},138 ${100 + side * 66},122 Z`,
            kit.second,
            4
          )
        ),
        ellipse(100, 116, 68, 66, kit.body),
        path(
          "M38,128 C50,170 80,182 100,182 C120,182 150,170 162,128 C140,146 120,150 100,150 C80,150 60,146 38,128 Z",
          kit.second
        ),
        faded(0.22, [
          ...Arr.map([-30, 0, 30], (x) => ellipse(100 + x, 70, 5, 5, INK)),
          ...Arr.map([-46, 46], (x) => ellipse(100 + x, 88, 4.4, 4.4, INK)),
        ]),
        // A small pout.
        ellipse(100, 134, 9, 8, "#ec9ab0"),
        ellipse(100, 134, 4.4, 3.4, kit.ink),
        eyes(kit, 30, 108, 8)
      ),
  },
  clownfish: {
    colors: [
      ["#f47c3c", PEARL],
      ["#f2a33a", PEARL],
    ],
    draw: (kit) =>
      figure(
        // Seen three quarters on, facing left: the tail and the fins edged in ink.
        rounded(
          "M172,96 C186,84 200,84 206,90 L206,150 C200,156 186,156 172,144 Z",
          kit.ink,
          6
        ),
        rounded(
          "M176,100 C188,92 198,92 202,96 L202,144 C198,148 188,148 176,140 Z",
          kit.body,
          4
        ),
        rounded(
          "M70,72 C80,46 108,38 134,44 C152,48 164,60 168,74 Z",
          kit.ink,
          6
        ),
        rounded(
          "M76,72 C86,52 108,46 132,50 C148,54 158,62 162,74 Z",
          kit.body,
          4
        ),
        ellipse(104, 122, 76, 58, kit.body),
        // Three white bands, each edged in ink.
        path(
          "M84,68 C104,92 108,148 88,178 L102,180 C124,148 120,92 100,66 Z",
          kit.ink
        ),
        path(
          "M88,68 C108,94 112,148 92,178 L98,178 C118,148 114,94 96,68 Z",
          kit.second
        ),
        path(
          "M132,68 C148,94 150,150 136,176 L150,174 C164,146 162,98 146,72 Z",
          kit.ink
        ),
        path(
          "M136,70 C152,96 154,148 140,174 L146,174 C158,146 156,98 142,72 Z",
          kit.second
        ),
        line("M50,138 Q60,146 70,138", kit.ink, 3.4),
        eye(kindAt(kit.eyes, -1), 46 + kit.look, 110, 7, kit.ink),
        eye(kindAt(kit.eyes, 1), 74 + kit.look, 110, 7.4, kit.ink)
      ),
  },
  starfish: {
    colors: [
      ["#f48a6a", "#f7d774"],
      ["#f2a33a", "#f4e6ce"],
      ["#e88fb0", PEARL],
    ],
    draw: (kit) =>
      figure(
        blob(star(100, 116, 96, 44), kit.body, 30),
        // Bumps along each arm.
        Arr.flatMap(Arr.range(0, 4), (index) => {
          const angle = ((-90 + index * 72) * Math.PI) / 180;
          return Arr.map([52, 72], (reach) =>
            ellipse(
              100 + Math.cos(angle) * reach,
              116 + Math.sin(angle) * reach,
              5,
              5,
              kit.second
            )
          );
        }),
        smile(130, 10, 6, kit.ink),
        eyes(kit, 18, 112, 6.4)
      ),
  },
  crab: {
    colors: [
      ["#ee6a5a", "#f6c3a6"],
      ["#f2a33a", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        // Raised claws, each with its pincer open.
        both((side) => [
          line(
            `M${100 + side * 50},150 C${100 + side * 70},140 ${100 + side * 76},120 ${100 + side * 74},96`,
            kit.body,
            14
          ),
          rounded(
            `M${100 + side * 60},92 C${100 + side * 58},66 ${100 + side * 72},50 ${100 + side * 90},52 L${100 + side * 82},74 L${100 + side * 96},80 C${100 + side * 94},96 ${100 + side * 82},106 ${100 + side * 72},106 C${100 + side * 64},104 ${100 + side * 60},98 ${100 + side * 60},92 Z`,
            kit.body,
            6
          ),
        ]),
        // Legs.
        both((side) => [
          line(
            `M${100 + side * 50},176 L${100 + side * 84},188 L${100 + side * 92},206`,
            kit.body,
            9
          ),
          line(
            `M${100 + side * 46},188 L${100 + side * 72},200 L${100 + side * 76},212`,
            kit.body,
            9
          ),
        ]),
        // Eyes on stalks over the shell.
        both((side) =>
          line(`M${100 + side * 18},128 L${100 + side * 22},96`, kit.body, 8)
        ),
        both((side) => ellipse(100 + side * 22, 94, 13, 13, kit.body)),
        ellipse(100, 166, 64, 42, kit.body),
        faded(
          0.18,
          both((side) => ellipse(100 + side * 28, 150, 6, 5, INK))
        ),
        ellipse(100, 186, 34, 14, kit.second),
        smile(170, 12, 6, kit.ink),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 22 + kit.look,
            94,
            6.4,
            kit.ink
          )
        )
      ),
  },
} satisfies Record<string, Design>;

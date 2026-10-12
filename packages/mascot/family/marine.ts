import {
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
  outlined,
  path,
  smile,
  spikes,
  torso,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** The animals of the open sea, the reef, and the shore. */
export const marine = {
  whale: {
    colors: [
      ["#aeb8f5", "#eef1fd"],
      ["#8fb7e8", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        line("M100,46 L100,34", kit.second, 6),
        both((side) =>
          line(
            `M100,34 Q${100 + side * 6},18 ${100 + side * 22},22`,
            kit.second,
            6
          )
        ),
        path(
          "M26,200 C20,150 34,58 100,56 C166,58 180,150 174,200 Z",
          kit.body
        ),
        path(
          "M28,128 C60,142 140,142 172,128 C170,162 142,200 100,200 C58,200 30,162 28,128 Z",
          kit.second
        ),
        eyes(kit, 50, 112),
        smile(128, 20, 9, kit.ink)
      ),
  },
  turtle: {
    colors: [
      ["#98cf82", "#e8b456"],
      ["#7fc7a0", "#efd2a6"],
    ],
    draw: (kit) =>
      figure(
        path(
          "M14,200 C14,150 50,112 100,112 C150,112 186,150 186,200 Z",
          kit.second
        ),
        faded(0.3, [
          ...both((side) => ellipse(100 + side * 52, 170, 16, 18, kit.body)),
          ellipse(100, 164, 16, 18, kit.body),
        ]),
        path(
          "M70,200 C70,176 76,150 84,134 L116,134 C124,150 130,176 130,200 Z",
          kit.body
        ),
        head(kit.body, 46, 44, 92),
        eyes(kit, 22, 88),
        smile(102, 14, 10, kit.ink)
      ),
  },
  octopus: {
    colors: [
      ["#f5a48e", "#f6c3a6"],
      ["#dcd3f4", "#f6f4ef"],
      ["#ec9ab0", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        Arr.map([28, 64, 100, 136, 172], (at) =>
          path(
            `M${at - 20},200 L${at - 20},150 C${at - 20},136 ${at + 20},136 ${at + 20},150 L${at + 20},200 Z`,
            kit.body
          )
        ),
        ellipse(100, 94, 64, 60, kit.body),
        Arr.map([28, 64, 100, 136, 172], (at) =>
          ellipse(at, 180, 5.6, 5.6, kit.second)
        ),
        eyes(kit, 24, 98),
        smile(112, 10, 9, kit.ink)
      ),
  },
  jellyfish: {
    colors: [
      ["#dcd3f4", "#f6f4ef"],
      ["#f4c7cf", "#f6f4ef"],
      ["#cfe6f7", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        Arr.map([56, 78, 100, 122, 144], (at) =>
          line(
            `M${at},134 Q${at - 9},152 ${at},168 Q${at + 9},184 ${at},204`,
            kit.body,
            9
          )
        ),
        path("M38,132 C38,76 64,44 100,44 C136,44 162,76 162,132 Z", kit.body),
        Arr.map([56, 78, 100, 122, 144], (at) =>
          ellipse(at, 132, 13, 10, kit.body)
        ),
        ellipse(70, 72, 8, 6, kit.second, -30),
        ellipse(128, 66, 6, 5, kit.second, 30),
        eyes(kit, 24, 102),
        smile(112, 10, 8, kit.ink)
      ),
  },
  pufferfish: {
    colors: [
      ["#f3e7a6", "#f6f4ef"],
      ["#8fd0c4", "#f6f4ef"],
      ["#f6c3a6", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        spikes(100, 120, 64, 82, 192, 348, 9, kit.body, 5),
        both((side) =>
          ellipse(100 + side * 74, 126, 13, 21, kit.body, side * 28)
        ),
        path(
          "M30,200 C22,150 44,52 100,52 C156,52 178,150 170,200 Z",
          kit.body
        ),
        path(
          "M34,136 C56,160 144,160 166,136 C164,176 134,200 100,200 C66,200 36,176 34,136 Z",
          kit.second
        ),
        both((side) => ellipse(100 + side * 44, 122, 8, 5.6, "#f5a48e")),
        eyes(kit, 28, 100, 8),
        ellipse(100, 126, 8.4, 7.4, kit.ink)
      ),
  },
  clownfish: {
    colors: [
      ["#f47c3c", "#f6f4ef"],
      ["#f2a33a", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        outlined("M76,62 C80,36 120,36 124,62 Z", kit.body, kit.ink, 3.4),
        both((side) => [
          ellipse(100 + side * 66, 134, 18, 27, kit.body, side * -24),
          ellipse(100 + side * 76, 142, 6, 13, kit.ink, side * -24),
        ]),
        torso(kit.body, 44),
        ellipse(100, 122, 66, 68, kit.body),
        both((side) =>
          outlined(
            `M${100 + side * 34},64 C${100 + side * 50},96 ${100 + side * 50},150 ${100 + side * 34},182 L${100 + side * 50},174 C${100 + side * 64},146 ${100 + side * 64},100 ${100 + side * 50},72 Z`,
            kit.second,
            kit.ink,
            3.4
          )
        ),
        eyes(kit, 15, 104, 6.6),
        smile(121, 11, 9, kit.ink)
      ),
  },
  starfish: {
    colors: [
      ["#f48a6a", "#f7d774"],
      ["#f2a33a", "#f4e6ce"],
      ["#e88fb0", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        blob(
          Arr.flatMap(Arr.range(0, 9), (index) => {
            const reach = index % 2 === 0 ? 92 : 44;
            const angle = -Math.PI / 2 + (index * Math.PI) / 5;
            return [
              100 + reach * Math.cos(angle),
              122 + reach * Math.sin(angle),
            ];
          }),
          kit.body,
          22
        ),
        ellipse(100, 54, 4.4, 4.4, kit.second),
        ellipse(100, 72, 3.4, 3.4, kit.second),
        both((side) => [
          ellipse(100 + side * 62, 104, 4.4, 4.4, kit.second),
          ellipse(100 + side * 46, 110, 3.4, 3.4, kit.second),
          ellipse(100 + side * 44, 176, 4.4, 4.4, kit.second),
        ]),
        both((side) => ellipse(100 + side * 26, 126, 7, 5, kit.second)),
        eyes(kit, 15, 112, 5.6),
        smile(124, 9, 7, kit.ink)
      ),
  },
  crab: {
    colors: [
      ["#ee6a5a", "#f6c3a6"],
      ["#f2a33a", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          line(
            `M${100 + side * 58},140 Q${100 + side * 86},128 ${100 + side * 80},98`,
            kit.body,
            11
          ),
          ellipse(100 + side * 78, 82, 21, 17, kit.body, side * -24),
          blob(
            [100 + side * 78, 82, 100 + side * 94, 64, 100 + side * 86, 82],
            kit.second,
            3
          ),
        ]),
        both((side) => [
          line(`M${100 + side * 22},112 L${100 + side * 26},74`, kit.body, 10),
          ellipse(100 + side * 26, 66, 15, 15, kit.body),
        ]),
        path(
          "M26,200 C20,146 52,104 100,104 C148,104 180,146 174,200 Z",
          kit.body
        ),
        path(
          "M58,200 C58,180 76,166 100,166 C124,166 142,180 142,200 Z",
          kit.second
        ),
        both((side) =>
          eye(
            kindAt(kit.eyes, side),
            100 + side * 26 + kit.look,
            66,
            6,
            kit.ink
          )
        ),
        smile(132, 16, 10, kit.ink)
      ),
  },
} satisfies Record<string, Design>;

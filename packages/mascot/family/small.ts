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
  path,
  roundEars,
  smile,
  spikes,
  torso,
  WHITE,
} from "@repo/mascot/kit";

/** The small mammals: the gnawers, the rabbit, the koala, and the bat. */
export const small = {
  kelinci: {
    colors: [
      ["#f6f4ef", "#f4c7cf"],
      ["#dcd3f4", "#f6f4ef"],
      ["#efd2a6", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          ellipse(100 + side * 24, 36, 15, 42, kit.body, side * 8),
          ellipse(100 + side * 24, 38, 7, 30, kit.second, side * 8),
        ]),
        torso(kit.body),
        head(kit.body, 56, 48, 102),
        belly(kit.second),
        both((side) => ellipse(100 + side * 34, 116, 10, 7, kit.second)),
        eyes(kit, 24, 98),
        nose(110, 4.6, 3.6, kit.ink),
        smile(117, 8, 7, kit.ink)
      ),
  },
  hamster: {
    colors: [
      ["#e8b456", "#f4e6ce"],
      ["#efd2a6", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 42, 52, 14),
        torso(kit.body, 60),
        head(kit.body, 64, 54, 100),
        both((side) => ellipse(100 + side * 30, 118, 26, 24, kit.second)),
        belly(kit.second, 30, 150),
        eyes(kit, 24, 92),
        nose(108, 4.6, 3.6, kit.ink),
        smile(114, 6, 6, kit.ink)
      ),
  },
  tikus: {
    colors: [
      ["#c9d2dc", "#f4c7cf"],
      ["#efd2a6", "#f4c7cf"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 50, 56, 28),
        torso(kit.body, 50),
        head(kit.body, 50, 46, 102),
        belly(kit.second, 26, 152),
        eyes(kit, 22, 98),
        nose(112, 5.6, 4.4, kit.second),
        smile(119, 7, 6, kit.ink)
      ),
  },
  tupai: {
    colors: [
      ["#d9824a", "#f4e6ce"],
      ["#b98a63", "#f6f4ef"],
      ["#b9c0cc", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        ellipse(160, 132, 34, 66, kit.body, 12),
        ellipse(146, 66, 30, 30, kit.body),
        ellipse(160, 128, 14, 46, kit.second, 12),
        both((side) =>
          blob(
            [100 + side * 40, 62, 100 + side * 46, 32, 100 + side * 22, 52],
            kit.body,
            10
          )
        ),
        torso(kit.body, 50),
        head(kit.body, 54, 50, 98),
        both((side) => ellipse(100 + side * 23, 114, 21, 18, kit.second)),
        belly(kit.second, 26, 152),
        eyes(kit, 24, 92),
        nose(106, 5, 3.8, kit.ink),
        path("M96,112 L104,112 L103,122 L97,122 Z", WHITE)
      ),
  },
  landak: {
    colors: [
      ["#b98a63", "#f4e6ce"],
      ["#8f6a4f", "#f6f4ef"],
    ],
    draw: (kit) =>
      figure(
        spikes(100, 108, 54, 80, 188, 352, 11, kit.body, 6),
        path(
          "M34,200 C30,150 46,96 100,96 C154,96 170,150 166,200 Z",
          kit.body
        ),
        ellipse(100, 108, 60, 54, kit.body),
        both((side) => ellipse(100 + side * 36, 82, 10, 10, kit.second)),
        path(
          "M56,200 C54,160 62,104 100,96 C138,104 146,160 144,200 Z",
          kit.second
        ),
        eyes(kit, 20, 118),
        nose(132, 6, 4.6, kit.ink),
        smile(140, 7, 5, kit.ink)
      ),
  },
  koala: {
    colors: [
      ["#c9d2dc", "#f6f4ef"],
      ["#b9c0cc", "#f4e6ce"],
    ],
    draw: (kit) =>
      figure(
        roundEars(kit.body, kit.second, 58, 72, 28),
        torso(kit.body),
        head(kit.body, 56, 52),
        belly(kit.second),
        eyes(kit, 30, 96),
        ellipse(100, 108, 12, 17, kit.ink),
        smile(130, 8, 6, kit.ink)
      ),
  },
  kelelawar: {
    colors: [
      ["#8e7fb8", "#f4c7cf"],
      ["#6f7fa8", "#dcd3f4"],
    ],
    draw: (kit) =>
      figure(
        both((side) => [
          blob(
            [100 + side * 52, 80, 100 + side * 58, 22, 100 + side * 18, 58],
            kit.body,
            12
          ),
          blob(
            [100 + side * 48, 68, 100 + side * 51, 40, 100 + side * 32, 58],
            kit.second,
            5
          ),
        ]),
        both((side) =>
          blob(
            [
              100 + side * 36,
              140,
              100 + side * 96,
              112,
              100 + side * 86,
              146,
              100 + side * 96,
              172,
              100 + side * 82,
              200,
              100 + side * 36,
              200,
            ],
            kit.body,
            8
          )
        ),
        torso(kit.body, 44),
        head(kit.body, 50, 46, 100),
        belly(kit.second, 22, 156),
        eyes(kit, 22, 96),
        nose(108, 4.4, 3.4, kit.ink),
        smile(116, 10, 7, kit.ink),
        both((side) =>
          blob(
            [
              100 + side * 7 - 2,
              122,
              100 + side * 7 + 2,
              122,
              100 + side * 7,
              128,
            ],
            WHITE,
            2
          )
        )
      ),
  },
} satisfies Record<string, Design>;

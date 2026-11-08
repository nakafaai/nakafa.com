import type { Sprite } from "@/lib/island/sprite";

/** A white duck paddling to the right, its tail flicking between frames. */
export const DUCK: Sprite = {
  fps: 3,
  frames: [
    [
      "....kkk...",
      "...kwwwk..",
      "...kwkwbb.",
      "...kwwwbk.",
      ".kk.kwwk..",
      "kwwkwwwwk.",
      "ksswwwwsk.",
      ".kkkkkkk..",
    ],
    [
      "....kkk...",
      "...kwwwk..",
      "...kwkwbb.",
      "...kwwwbk.",
      "kk..kwwk..",
      "kwwkwwwwk.",
      ".sswwwwsk.",
      ".kkkkkkk..",
    ],
  ],
  key: {
    b: ["glow", 1],
    k: ["ink", 1],
    s: ["feather", 1],
    w: ["feather", 3],
  },
};

/** A small orange fish swimming to the right, its tail beating between frames. */
export const FISH: Sprite = {
  fps: 4,
  frames: [
    ["o.ooo..", ".oooodo", "o.ooo.."],
    [".oooo..", "ooooodo", ".oooo.."],
  ],
  key: {
    d: ["ink", 1],
    o: ["fur", 2],
  },
};

/**
 * Nina peeking out of the water: her hammer head with an eye at each end, two
 * small bumps on top, a pale face and one smile, as the mascot draws her.
 */
export const NINA_PEEK: Sprite = {
  fps: 2,
  frames: [
    [
      "...kk....kk...",
      "..knnk..knnk..",
      ".knnnnnnnnnnk.",
      "kfkknnnnnnkkfk",
      "kffknnnnnnkffk",
      ".kkknffffnkkk.",
      "...knfkkfnk...",
      "...kffffffk...",
    ],
    [
      "...kk....kk...",
      "..knnk..knnk..",
      ".knnnnnnnnnnk.",
      "kffknnnnnnkffk",
      "kfkknnnnnnkkfk",
      ".kkknffffnkkk.",
      "...knfkkfnk...",
      "...kffffffk...",
    ],
  ],
  key: {
    f: ["nina", 3],
    k: ["ink", 1],
    n: ["nina", 2],
  },
};

/** A little bed of flowers that sways in the wind between frames. */
export const FLOWERS: Sprite = {
  fps: 1,
  frames: [
    [".p...y..", "pcp.yoy.", ".p.g.y.p", ".g.g..pcp", "gg.gg.gp.", ".ggg.ggg."],
    ["..p..y..", ".pcpyoy.", "..pg.y.p", ".g.g.pcp.", "gg.gg.gp.", ".ggg.ggg."],
  ],
  key: {
    c: ["glow", 3],
    g: ["leaf", 2],
    o: ["glow", 1],
    p: ["petal", 2],
    y: ["glow", 2],
  },
};

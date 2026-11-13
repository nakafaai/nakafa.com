import { type Ink, rowsTile } from "@/lib/island/tiles/paint";

/** The colors the animals are drawn in, by the characters their rows use. */
const LEGEND: Readonly<Record<string, Ink>> = {
  B: ["bark", 0],
  O: ["gold", 0],
  S: ["slate", 0],
  W: ["plaster", 1],
  b: ["bark", 2],
  g: ["leaf", 2],
  h: ["slate", 2],
  k: ["ink", 0],
  o: ["gold", 2],
  r: ["roof", 2],
  s: ["slate", 1],
  w: ["plaster", 3],
};

/** A hen's body, head held up, facing east; her legs change with each step. */
const HEN = [
  "................",
  "................",
  "................",
  ".........rr.....",
  "........rwwr....",
  "........wwkwo...",
  "........wwwwoo..",
  "...W....wwww....",
  "..WWwwwwwwww....",
  "..WWwwwwwwww....",
  "...WWwwwwwwW....",
  "....WWwwwwW.....",
  ".....WWWWW......",
] as const;

/** A duck floating, facing east, its green head over a brown body. */
const DUCK = [
  "................",
  "................",
  "................",
  "................",
  "................",
  ".........ggg....",
  "........gggkgo..",
  "........ggggoo..",
  ".........gg.....",
  "...bb...bbb.....",
  "..bBbbbbbbbb....",
  "..bBBbbbbbbbb...",
  "...BBBbbbbbB....",
  "....BBBBBBB.....",
  "................",
  "................",
] as const;

/** A hen mid-stride, legs apart. */
export function henTile() {
  return rowsTile(
    [...HEN, "......O..O......", "......O..O......", ".....OO.OO......"],
    LEGEND
  );
}

/** A hen's other stride, legs crossed under her. */
export function henStepTile() {
  return rowsTile(
    [...HEN, ".......O.O......", "......O...O.....", ".....OO..OO....."],
    LEGEND
  );
}

/** A duck on the water. */
export function duckTile() {
  return rowsTile(DUCK, LEGEND);
}

/** Nina's left side seen from above, her hammer head to the east: one end of the hammer and a fin. */
const NINA_LEFT = [
  "................",
  "..............kS",
  "..............sS",
  ".............ssS",
  "..........S..ss.",
  "..........SSsss.",
] as const;

/** Nina's right side seen from above: her other fin and the hammer's other end. */
const NINA_RIGHT = [
  "..........SSsss.",
  "..........S..ss.",
  ".............ssS",
  "..............sS",
  "..............kS",
] as const;

/** Nina, the hammerhead, swimming at the surface, her tail spread wide. */
export function ninaTile() {
  return rowsTile(
    [
      ...NINA_LEFT,
      "S.........sssss.",
      "sS..ssssssssss..",
      "sSShhhhhhhhhhs..",
      "sS..ssssssssss..",
      "S.........sssss.",
      ...NINA_RIGHT,
    ],
    LEGEND
  );
}

/** Nina's other stroke, her tail drawn in behind her. */
export function ninaStepTile() {
  return rowsTile(
    [
      ...NINA_LEFT,
      "..........sssss.",
      ".S..ssssssssss..",
      "SSShhhhhhhhhhs..",
      ".S..ssssssssss..",
      "..........sssss.",
      ...NINA_RIGHT,
    ],
    LEGEND
  );
}

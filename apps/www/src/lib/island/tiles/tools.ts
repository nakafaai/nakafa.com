import { type Ink, rowsTile } from "@/lib/island/tiles/paint";

/** The colors the tools are drawn in. */
const LEGEND: Readonly<Record<string, Ink>> = {
  M: ["metal", 1],
  b: ["bark", 2],
  m: ["metal", 3],
  o: ["ink", 0],
  p: ["wool", 2],
  r: ["roof", 2],
  s: ["plaster", 3],
  w: ["wood", 2],
};

/** A pickaxe, its head at the top left, where the cursor's point is. */
export function pickaxeTile() {
  return rowsTile(
    [
      "..oooooo........",
      ".ommmmmmoo......",
      "omMooooMmmo.....",
      "oMo...owoMmo....",
      "oo....ow.oMo....",
      "......owo.oo....",
      ".......owo......",
      "........owo.....",
      ".........owo....",
      "..........owo...",
      "...........owo..",
      "............owo.",
      ".............oo.",
      "................",
      "................",
      "................",
    ],
    LEGEND
  );
}

/** A hammer, its head at the top left, for placing a ready-made item. */
export function hammerTile() {
  return rowsTile(
    [
      "..ooooo.........",
      ".ommmmmo........",
      "omMMMMmmo.......",
      "ommmmmmmo.......",
      ".oooooowo.......",
      "......owo.......",
      ".......owo......",
      "........owo.....",
      ".........owo....",
      "..........owo...",
      "...........owo..",
      "............oo..",
      "................",
      "................",
      "................",
      "................",
    ],
    LEGEND
  );
}

/** Two footprints, for walking the fox. */
export function feetTile() {
  return rowsTile(
    [
      "................",
      "...ooo..........",
      "..obbbo.........",
      "..obbbo.........",
      "..obbbo...ooo...",
      "...obo...obbbo..",
      "...ooo...obbbo..",
      "..o.o.o..obbbo..",
      "..........obo...",
      "..........ooo...",
      ".........o.o.o..",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    LEGEND
  );
}

/** A fishing rod, its tip at the top right where the line leaves it. */
export function rodTile() {
  return rowsTile(
    [
      "..............oo",
      ".............owo",
      "............owo.",
      "...........owo..",
      "..........owo...",
      ".........owo....",
      "........owo.....",
      ".......owo......",
      "......owo.......",
      ".....obbo.......",
      "....obbbo.......",
      "...obbbo........",
      "..obbbo.........",
      "..oooo..........",
      "................",
      "................",
    ],
    LEGEND
  );
}

/** A float on the water: red over white, small enough to bob on a wave. */
export function bobberTile() {
  return rowsTile(
    [
      "................",
      "................",
      "................",
      "................",
      ".......oo.......",
      ".......oo.......",
      "......orro......",
      ".....orrrro.....",
      ".....orrrro.....",
      ".....osssso.....",
      ".....osssso.....",
      "......osso......",
      ".......oo.......",
      "................",
      "................",
      "................",
    ],
    LEGEND
  );
}

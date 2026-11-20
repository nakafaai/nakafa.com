import type { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, Option, Order } from "effect";
import { animalBodies, joined } from "@/lib/island/bodies";
import { blocksAt } from "@/lib/island/collide";
import { flightBodies, flightsOf } from "@/lib/island/fauna/flights";
import { CELL, cellKey, surveyOf } from "@/lib/island/fauna/habitat";
import { swimBodies, swimsOf } from "@/lib/island/fauna/swims";
import type { Root, Roots } from "@/lib/island/flora/rooted";
import {
  blockersAbout,
  rootAt,
  rootedBodies,
  rootsOf,
} from "@/lib/island/flora/rooted";
import type { Land } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import type { Animal } from "@/lib/island/life";
import type { Model } from "@/lib/island/models/kinds";
import {
  isAsleep,
  keepDay,
  tackleBodies,
  villagersOf,
} from "@/lib/island/routine";
import { baitOf, schoolBodies, schoolsOf } from "@/lib/island/schools";
import { dwellersOf, roamed } from "@/lib/island/wild";

/**
 * How far life reaches from the anchor (ADR 0050, W9), in blocks from it to a
 * cell's middle: a cell nearer than `found` is filled, which keeps it inside
 * the window of land the painter already made, one farther than `kept` is
 * forgotten, and no more than `each` is filled in one frame, the nearest
 * first, so walking into new land never stalls a frame.
 */
const REACH = { each: 1, found: 88, kept: 128 } as const;

/** How far the widest thing reaches from its middle, in blocks, so a walker asks the chunk beside it too. */
const MARGIN = 5;

/** The trees a bird comes down to. */
const TREES: readonly Thing[] = [
  "mango",
  "flame",
  "casuarina",
  "palm",
  "banana",
  "pine",
];

/** What a walker of this land cannot pass at a place (ADR 0047, D22): the trunks, the rocks and the walls about it, asked with the walker's half width. */
function blockedBy(roots: Roots, land: Land) {
  return (x: number, z: number, half: number) =>
    blocksAt(blockersAbout(roots, land, [x, z], MARGIN), x, z, half);
}

/** What stands in the four chunks of a cell. */
function chunksOf(roots: Roots, land: Land, gx: number, gz: number) {
  return Arr.makeBy(4, (slot) =>
    rootAt(roots, land, gx * 2 + (slot % 2), gz * 2 + Math.floor(slot / 2))
  );
}

/** The tops of a cell's trees, where a bird perches. */
function crownsOf(standing: Root["standing"]) {
  return Arr.map(
    Arr.filter(
      standing,
      ({ model }) => model._tag === "thing" && Arr.contains(TREES, model.kind)
    ),
    (tree) => [tree.x, tree.y + tree.height, tree.z] as const
  );
}

/** A cell's corals, where the reef's fish keep, each with whether it is an anemone a clownfish would hold. */
function coralsOf(standing: Root["standing"]) {
  return Arr.map(
    Arr.filter(
      standing,
      ({ model }) =>
        model._tag === "reef" &&
        model.kind !== "lily" &&
        model.kind !== "seagrass"
    ),
    (coral) => ({
      anemone: coral.model._tag === "reef" && coral.model.kind === "anemone",
      x: coral.x,
      y: coral.y,
      z: coral.z,
    })
  );
}

/** The villagers of a cell from what stands in it, the campers among them where the world opens in it. */
function folkOf(
  land: Land,
  cell: {
    readonly chunks: readonly Root[];
    readonly gx: number;
    readonly gz: number;
    readonly survey: ReturnType<typeof surveyOf>;
  },
  world: {
    readonly camp: readonly [number, number];
    readonly day: number;
  },
  held: Parameters<typeof villagersOf>[4]["held"]
) {
  const opens =
    Math.floor(world.camp[0] / CELL) === cell.gx &&
    Math.floor(world.camp[1] / CELL) === cell.gz;
  return villagersOf(
    land,
    Arr.flatMap(cell.chunks, (chunk) => chunk.standing),
    cell.survey,
    { day: world.day, gx: cell.gx, gz: cell.gz, seed: land.seed },
    { camp: opens ? Option.some(world.camp) : Option.none(), held }
  );
}

/**
 * One cell of life (ADR 0050, W9), filled from the land found in it by the
 * seed, the cell and the day: the animals that walk and float there, the
 * creatures of its air, its fish, its big swimmer and its villagers.
 */
function cellOf(
  land: Land,
  roots: Roots,
  world: {
    readonly camp: readonly [number, number];
    readonly day: number;
    readonly gx: number;
    readonly gz: number;
  }
) {
  const { gx, gz } = world;
  const dice = { day: world.day, gx, gz, seed: land.seed };
  const survey = surveyOf(land, gx, gz);
  const chunks = chunksOf(roots, land, gx, gz);
  const standing = Arr.flatMap(chunks, (chunk) => chunk.standing);
  const swims = swimsOf(land, survey.sea, dice);
  return {
    chunks,
    dwellers: dwellersOf(land, survey, dice, blockedBy(roots, land)),
    flights: flightsOf(land, survey, dice, crownsOf(standing)),
    gx,
    gz,
    key: cellKey(gx, gz),
    schools: [
      ...schoolsOf(land, survey, dice, coralsOf(standing)),
      ...Arr.getSomes(
        Arr.map(swims, (swim) =>
          swim._tag === "hunter" ? baitOf(swim.hunt) : Option.none()
        )
      ),
    ],
    survey,
    swims,
    villagers: folkOf(land, { chunks, gx, gz, survey }, world, []),
  };
}
type Cell = ReturnType<typeof cellOf>;

/** Every animal of the cells a body keeps apart from at `hour`: all that walk and float, and the villagers who are not asleep indoors. */
function herdOf(cells: readonly Cell[], hour: number) {
  return Arr.flatMap(cells, (cell) => [
    ...cell.dwellers,
    ...Arr.map(
      Arr.filter(cell.villagers, (villager) => !isAsleep(villager, hour)),
      (villager) => villager.body
    ),
  ]);
}

/**
 * Everything alive in a learner's world that the painter draws as bodies
 * (ADR 0047, D53; ADR 0050, W9), the same on the home page as in the game:
 * the cells of life found so far, empty until the anchor comes near them, the
 * land animals of all of them as `herd`, what stands on the land by chunk,
 * the camp where the world opens, and the day that picks its visitors.
 */
export function sceneOf(land: Land, day: number) {
  return {
    camp: homeOf(land.seed),
    cells: Arr.empty<Cell>(),
    day,
    herd: herdOf([], 0),
    roots: rootsOf(),
  };
}
export type Scene = ReturnType<typeof sceneOf>;

/** How far a cell's middle lies from a place, along the longer of the two ways. */
function awayOf(gx: number, gz: number, place: readonly [number, number]) {
  return Math.max(
    Math.abs((gx + 0.5) * CELL - place[0]),
    Math.abs((gz + 0.5) * CELL - place[1])
  );
}

/** The cells within reach of the anchor that no life was found in yet, the nearest first. */
function missingOf(cells: readonly Cell[], anchor: readonly [number, number]) {
  const from = (at: number) => Math.ceil((at - REACH.found) / CELL - 0.5);
  const to = (at: number) => Math.floor((at + REACH.found) / CELL - 0.5);
  const wanted = Arr.flatMap(Arr.range(from(anchor[0]), to(anchor[0])), (gx) =>
    Arr.map(
      Arr.range(from(anchor[1]), to(anchor[1])),
      (gz) => [gx, gz] as const
    )
  );
  return Arr.sort(
    Arr.filter(
      wanted,
      ([gx, gz]) => !Arr.some(cells, (cell) => cell.gx === gx && cell.gz === gz)
    ),
    Order.mapInput(Order.Number, ([gx, gz]: readonly [number, number]) =>
      awayOf(gx, gz, anchor)
    )
  );
}

/**
 * The scene `passed` seconds on at `hour`, about the anchor (ADR 0050, W9):
 * the cells that fell behind are forgotten and the nearest of those that came
 * within reach are filled, so an hour's walk keeps only the life about the
 * learner; then each animal of each cell wanders with its pack, runs from the
 * fox among `others` or stands for the stroke it got, and each villager keeps
 * its day (D54), all among each other and among `others`. A cell whose
 * buildings changed gets its villagers anew, those already there staying
 * where they stand.
 */
export function livedOf(
  scene: Scene,
  land: Land,
  passed: number,
  hour: number,
  anchor: readonly [number, number],
  others: readonly Animal[]
): Scene {
  const kept = Arr.filter(
    scene.cells,
    (cell) => awayOf(cell.gx, cell.gz, anchor) <= REACH.kept
  );
  const found = Arr.map(
    Arr.take(missingOf(kept, anchor), REACH.each),
    ([gx, gz]) =>
      cellOf(land, scene.roots, { camp: scene.camp, day: scene.day, gx, gz })
  );
  const blocked = blockedBy(scene.roots, land);
  const cells = Arr.map([...kept, ...found], (cell): Cell => {
    const chunks = chunksOf(scene.roots, land, cell.gx, cell.gz);
    const rebuilt = Arr.some(
      chunks,
      (chunk, slot) => chunk !== cell.chunks[slot]
    );
    const settled = rebuilt
      ? folkOf(land, { ...cell, chunks }, scene, cell.villagers)
      : cell.villagers;
    const folk = Arr.map(settled, (villager) => villager.body);
    const dwellers = roamed(land, cell.dwellers, {
      blocked,
      dt: passed,
      others: folk,
      threats: others,
    });
    return {
      ...cell,
      chunks,
      dwellers,
      villagers: Arr.map(settled, (villager) =>
        keepDay(land, villager, {
          blocked,
          dt: passed,
          hour,
          others: [...dwellers, ...folk, ...others],
        })
      ),
    };
  });
  return { ...scene, cells, herd: herdOf(cells, hour) };
}

/**
 * Every body of the scene to draw (ADR 0047, D50; ADR 0050, W9 and W10),
 * each model once with all its bodies: the wild plants and the things that
 * stand within sight of the anchor, kept from frame to frame until the
 * learner changes them; then, at `seconds` on the clock and `hour` of the
 * day, the animals of the land with `extra` among them (the learner's fox),
 * the big swimmers, the fish, the creatures of the air, and the rod of a
 * villager who fishes.
 */
export function sceneBodies(
  scene: Scene,
  land: Land,
  at: {
    readonly anchor: readonly [number, number];
    readonly extra: readonly Animal[];
    readonly hour: number;
    readonly revision: number;
    readonly seconds: number;
  }
): readonly (readonly [Model, Float32Array])[] {
  return [
    ...rootedBodies(scene.roots, land, at.anchor, at.revision),
    ...joined([
      ...animalBodies(land, [...scene.herd, ...at.extra]),
      ...Arr.flatMap(scene.cells, (cell) => [
        ...swimBodies(cell.swims, at.seconds),
        ...schoolBodies(land, cell.schools, at.seconds),
        ...flightBodies(cell.flights, at.seconds),
        ...tackleBodies(land, cell.villagers, at.hour),
      ]),
    ]),
  ];
}

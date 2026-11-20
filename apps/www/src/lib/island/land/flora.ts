import { Array as Arr, MutableHashMap, Option } from "effect";
import { CHUNK, indexOf, keyOf } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { chunkOver, heightAt, slopeAt } from "@/lib/island/land/ground";
import { smoothOf, unitOf } from "@/lib/island/noise";

/** A wild plant or rock a chunk grows by itself, by the habit of its model. */
export type Wild =
  | "banana"
  | "brain"
  | "bush"
  | "coral"
  | "flame"
  | "lily"
  | "palm"
  | "pine"
  | "reed"
  | "rocks"
  | "seagrass"
  | "tree";

/** A chunk's wild plants root in cells this many blocks on a side, two tries a cell. */
const CELL = 4;
const TRIES = 2;

/** What a try at one cell knows of its place, from which its plant is decided. */
type Site = Parameters<typeof wildOf>[0];

/** The plant of a place under water: reeds and lilies in fresh shallows, a reef in patches on the shallow sea bed with sea grass between. */
function wetWildOf(site: {
  depth: number;
  elevation: number;
  first: boolean;
  p: number;
  q: number;
  reef: boolean;
  wet: number;
}): Option.Option<Wild> {
  if (site.elevation > 0.3) {
    if (site.depth < 0.7 && site.first && site.p < 0.3) {
      return Option.some(site.wet < 0.2 ? "reed" : "lily");
    }
    return Option.none();
  }
  if (site.depth <= 0.7 || site.depth >= 3.6) {
    return Option.none();
  }
  if (site.reef && site.p < 0.6) {
    if (site.q < 0.42) {
      return Option.some("coral");
    }
    return Option.some(site.q < 0.72 ? "brain" : "seagrass");
  }
  return site.p < 0.07 ? Option.some("seagrass") : Option.none();
}

/** The tree of a wooded place: pines on the high terraces, and below them mostly broad crowns with a flame tree or a banana plant among them. */
function treeOf(elevation: number, q: number): Wild {
  if (elevation > 13) {
    return "pine";
  }
  if (q < 0.72) {
    return "tree";
  }
  return q < 0.86 ? "flame" : "banana";
}

/** The plant of a beach: a palm above the wet sand, and the odd rock. */
function beachWildOf(site: {
  elevation: number;
  first: boolean;
  p: number;
}): Option.Option<Wild> {
  if (site.first && site.p < 0.12 && site.elevation > 0.9) {
    return Option.some("palm");
  }
  return site.p > 0.97 ? Option.some("rocks") : Option.none();
}

/** What the second try of a cell fills open ground with: bushes, rocks, and a lone tree where no wood stands. */
function fillWildOf(site: { forest: number; p: number }): Option.Option<Wild> {
  if (site.p < 0.035 + site.forest * 0.1) {
    return Option.some("bush");
  }
  if (site.p > 0.975) {
    return Option.some("rocks");
  }
  return site.p > 0.955 && site.forest < 0.3
    ? Option.some("tree")
    : Option.none();
}

/**
 * What grows wild at one try of one cell (ADR 0050, W1), none for most: the
 * place's water, elevation, steepness, sand and woods decide the habit, and
 * the try's own two numbers `p` and `q` decide whether and which.
 */
export function wildOf(site: {
  depth: number;
  elevation: number;
  first: boolean;
  forest: number;
  p: number;
  q: number;
  reef: boolean;
  sand: number;
  slope: number;
  wet: number;
}): Option.Option<Wild> {
  if (site.depth > 0.05) {
    return wetWildOf(site);
  }
  if (site.elevation < 0.4) {
    return Option.none();
  }
  if (site.slope > 0.75) {
    return site.p < 0.2 ? Option.some("rocks") : Option.none();
  }
  if (site.wet > -0.5) {
    return site.p < 0.28 ? Option.some("reed") : Option.none();
  }
  if (site.sand > 0.5) {
    return beachWildOf(site);
  }
  return site.first
    ? Option.map(
        Option.liftPredicate(site.p, (p) => p < site.forest * 0.4),
        () => treeOf(site.elevation, site.q)
      )
    : fillWildOf(site);
}

/** One try at one cell: where it would root, and what the land there gives its plant to decide from. */
function tryAt(land: Land, cellX: number, cellZ: number, attempt: number) {
  const seed = land.seed + 300 + attempt * 57;
  const x = cellX * CELL + 0.4 + unitOf(seed, cellX, 0, cellZ) * 3.2;
  const z = cellZ * CELL + 0.4 + unitOf(seed, cellX, 1, cellZ) * 3.2;
  const i = Math.round(x);
  const j = Math.round(z);
  const chunk = chunkOver(land, i, j);
  const index = indexOf(i, j);
  const site: Site = {
    depth: chunk.surfaces[index] - chunk.heights[index],
    elevation: chunk.elevations[index],
    first: attempt === 0,
    forest: Math.min(
      1,
      Math.max(0, (chunk.kinds[index * 4 + 3] / 255 - 0.3) * 2.2)
    ),
    p: unitOf(seed, cellX, 2, cellZ),
    q: unitOf(seed, cellX, 3, cellZ),
    reef: smoothOf(land.seed + 91, x, z, 34) > 0.54,
    sand: chunk.kinds[index * 4 + 1] / 255,
    slope: slopeAt(land, x, z),
    wet: chunk.wets[index],
  };
  const cleared = Option.match(
    MutableHashMap.get(
      land.clears,
      keyOf(Math.floor(i / CHUNK), Math.floor(j / CHUNK))
    ),
    { onNone: () => false, onSome: (clears) => clears[index] === 1 }
  );
  const paved = chunk.kinds[index * 4] > 127;
  return { cleared, i, j, paved, site, surface: chunk.surfaces[index], x, z };
}

/**
 * The wild plants and rocks rooted in one chunk (ADR 0050, W1), the same for
 * everyone who opens the seed: where each stands, the height of its foot (a
 * lily's on the water's face), how large it grew from 0.78 to 1.28 of its
 * kind, its turn, and the lattice point that clears it. A path grows nothing,
 * and neither does a point the learner cleared.
 */
export function floraOf(land: Land, cx: number, cz: number) {
  const cells = CHUNK / CELL;
  return Arr.getSomes(
    Arr.makeBy(cells * cells * TRIES, (slot) => {
      const cell = Math.floor(slot / TRIES);
      const found = tryAt(
        land,
        cx * cells + (cell % cells),
        cz * cells + Math.floor(cell / cells),
        slot % TRIES
      );
      const kind =
        found.cleared || found.paved ? Option.none() : wildOf(found.site);
      return Option.map(kind, (wild) => ({
        i: found.i,
        j: found.j,
        kind: wild,
        size: 0.78 + found.site.q * 0.5,
        turn: found.site.p * 97,
        x: found.x,
        y: wild === "lily" ? found.surface : heightAt(land, found.x, found.z),
        z: found.z,
      }));
    })
  );
}

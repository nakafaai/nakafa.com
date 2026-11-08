import { footprintOf } from "@repo/backend/confect/island/item";
import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr, Option, Schema } from "effect";
import { drawingOf } from "@/lib/island/models";
import { POND_DEPTH } from "@/lib/island/models/pond";
import { VOXELS_PER_CELL } from "@/lib/island/terrain";

/** How far a pond's water stands below the grass, in voxels. */
export const WATER_BELOW = 2;

/**
 * The pieces an island draws from its layout: each placement with a drawing,
 * keyed by item and stage so placements of one kind share one mesh, with the
 * world point its footprint centres on, the voxel of its grid that sits there,
 * and its turn in radians (quarter turns clockwise seen from above).
 */
export function piecesOf(layout: readonly Placement[]) {
  return Arr.getSomes(
    Arr.map(layout, (placement) =>
      Option.map(drawingOf(placement.item, placement.stage), (drawing) => {
        const [east, south] = footprintOf(placement.item, 0);
        const [width, depth] = footprintOf(placement.item, placement.rotation);
        return {
          angle: (-placement.rotation * Math.PI) / 2,
          center: [
            placement.x + width / 2,
            placement.z,
            placement.y + depth / 2,
          ] as const,
          drawing,
          key: `${placement.item}:${placement.stage}`,
          pivot: [
            drawing.origin[0] + (east * VOXELS_PER_CELL) / 2,
            drawing.below,
            drawing.origin[1] + (south * VOXELS_PER_CELL) / 2,
          ] as const,
        };
      })
    )
  );
}

/** The ponds of a layout: the cells each covers once turned. */
function pondsOf(layout: readonly Placement[]) {
  return Arr.map(
    Arr.filter(layout, (placement) => placement.item === "pond"),
    (pond) => {
      const [width, depth] = footprintOf("pond", pond.rotation);
      return { depth, stage: pond.stage, width, x: pond.x, y: pond.y };
    }
  );
}

/** The holes the island's body leaves for its ponds. */
export function basinsOf(layout: readonly Placement[]) {
  return Arr.map(pondsOf(layout), (pond) => ({
    cells: [pond.x, pond.y, pond.width, pond.depth] as const,
    depth: POND_DEPTH,
  }));
}

/** The water of each pond as a box in world units, from its floor to its surface. */
export function watersOf(layout: readonly Placement[]) {
  return Arr.map(pondsOf(layout), (pond) => ({
    from: [pond.x, -POND_DEPTH / VOXELS_PER_CELL, pond.y] as const,
    to: [
      pond.x + pond.width,
      -WATER_BELOW / VOXELS_PER_CELL,
      pond.y + pond.depth,
    ] as const,
  }));
}

/** An animal of a pond: what it is, the part of its pond it swims in, how deep, and where in its swim it starts. */
export const PondAnimal = Schema.Struct({
  animal: Schema.Literals(["fish", "duck", "nina"]),
  area: Schema.Struct({
    from: Schema.Tuple([Schema.Finite, Schema.Finite]),
    to: Schema.Tuple([Schema.Finite, Schema.Finite]),
  }),
  depth: Schema.Finite,
  phase: Schema.Finite,
});
export type PondAnimal = typeof PondAnimal.Type;

/**
 * Where each pond's animals live: fish in every pond, ducks and Nina once it
 * has lilies. Each animal swims across its pond in world units.
 */
export function wildlifeOf(
  layout: readonly Placement[]
): readonly PondAnimal[] {
  return Arr.flatMap(pondsOf(layout), (pond) => {
    const area = {
      from: [pond.x + 0.4, pond.y + 0.4] as const,
      to: [pond.x + pond.width - 0.4, pond.y + pond.depth - 0.4] as const,
    };
    const fish: readonly PondAnimal[] = [
      { animal: "fish", area, depth: 0.55, phase: 0 },
      { animal: "fish", area, depth: 0.95, phase: 0.5 },
    ];
    const lively: readonly PondAnimal[] = [
      { animal: "duck", area, depth: 0, phase: 0.2 },
      { animal: "duck", area, depth: 0, phase: 0.7 },
      { animal: "nina", area, depth: 0, phase: 0.4 },
    ];
    return pond.stage >= 1 ? [...fish, ...lively] : fish;
  });
}

/**
 * The still sprites a layout stands up: a bed of flowers on each cell that holds
 * one, at the middle of its cell, on the layer it stands on.
 */
export function floraOf(layout: readonly Placement[]) {
  return Arr.map(
    Arr.filter(layout, (placement) => placement.item === "flowers"),
    (flowers) => ({
      sprite: "flowers" as const,
      x: flowers.x + 0.5,
      y: flowers.z,
      z: flowers.y + 0.5,
    })
  );
}

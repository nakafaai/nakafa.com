import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr, Record } from "effect";
import { useMemo } from "react";
import { IslandPicker } from "@/components/island/pick";
import { Wildlife } from "@/components/island/sprites";
import { useTools } from "@/components/island/tools";
import { VoxelMesh } from "@/components/island/voxels";
import { chimneysOf, firefliesOf } from "@/lib/island/life";
import { CLOUD_SHAPES, CLOUD_SIZE } from "@/lib/island/models/cloud";
import { basinsOf, floraOf, piecesOf, wildlifeOf } from "@/lib/island/pieces";
import { BODY_DEPTH, drawTerrain, VOXELS_PER_CELL } from "@/lib/island/terrain";
import { drawModel } from "@/lib/island/voxel";

/** Where the clouds float under and around an island of `size` cells. */
function cloudPlacements(size: number) {
  return [
    {
      angle: 0,
      center: [size * 0.15, -3.6, size * 0.95] as const,
      pivot: [20, 5, 14] as const,
    },
    {
      angle: Math.PI / 2,
      center: [size * 1.05, -4.4, size * 0.2] as const,
      pivot: [20, 5, 14] as const,
    },
    {
      angle: 0,
      center: [size * 0.75, -5.2, size * 1.15] as const,
      pivot: [20, 5, 14] as const,
    },
  ];
}

/**
 * Everything the island draws in its scene pass: the body cut for its ponds,
 * one instanced mesh for each kind of piece on it, its animals, smoke and
 * fireflies, and the clouds
 * under it. The island turns about its centre in quarter steps.
 */
export function IslandScene({
  angle,
  layout,
  size,
}: {
  angle: number;
  layout: readonly Placement[];
  size: number;
}) {
  const terrain = useMemo(
    () => drawTerrain(size, 7, basinsOf(layout)),
    [layout, size]
  );
  const kinds = useMemo(
    () =>
      Record.values(
        Record.map(
          Arr.groupBy(piecesOf(layout), (piece) => piece.key),
          (pieces) => ({
            grid: drawModel(
              pieces[0].drawing.size,
              pieces[0].drawing.shapes,
              3
            ),
            key: pieces[0].key,
            pieces,
          })
        )
      ),
    [layout]
  );
  const cloud = useMemo(() => drawModel(CLOUD_SIZE, CLOUD_SHAPES, 5), []);
  const animals = useMemo(() => wildlifeOf(layout), [layout]);
  const flora = useMemo(() => floraOf(layout), [layout]);
  const chimneys = useMemo(() => chimneysOf(layout), [layout]);
  const flies = useMemo(() => firefliesOf(layout), [layout]);
  const building = useTools((state) => state.building);
  return (
    <>
      <group position={[size / 2, 0, size / 2]} rotation={[0, angle, 0]}>
        <group position={[-size / 2, 0, -size / 2]}>
          <VoxelMesh
            grid={terrain}
            placements={[
              {
                angle: 0,
                center: [0, -BODY_DEPTH / VOXELS_PER_CELL, 0],
                pivot: [0, 0, 0],
              },
            ]}
          />
          {Arr.map(kinds, (kind) => (
            <VoxelMesh
              grid={kind.grid}
              key={kind.key}
              placements={kind.pieces}
            />
          ))}
          <Wildlife
            animals={animals}
            chimneys={chimneys}
            flies={flies}
            flora={flora}
          />
          {building ? <IslandPicker /> : null}
        </group>
      </group>
      <VoxelMesh grid={cloud} placements={cloudPlacements(size)} />
    </>
  );
}

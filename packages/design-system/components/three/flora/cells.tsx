import { cellsOf } from "@repo/design-system/components/three/flora/solid";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { useEffect, useMemo } from "react";
import { MeshPhysicalMaterial, SphereGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * The cells of a plant organ cut open: every cell in `cells` (the numbers
 * `sectionCells` and `bendCells` give) stands out of the cut face as a walled
 * body with its vacuole and its stained nucleus, hundreds of them in four
 * draw calls. `tones` colours the living body of a cell by its zone: cap,
 * division, elongation and mature.
 *
 * @param cells - Where every cell is, as `CELL_STRIDE` numbers each
 * @param depth - How far the cells stand out of the cut face
 * @param tones - The colour of a cell's body in each of the four zones
 */
export function Cells({
  cells,
  depth,
  tones,
}: {
  readonly cells: readonly number[];
  readonly depth: number;
  readonly tones: readonly [string, string, string, string];
}) {
  const built = useMemo(() => {
    const box = new RoundedBoxGeometry(1, 1, 1, 3, 0.16);
    const ball = new SphereGeometry(0.5, 16, 12);
    const materials = {
      body: new MeshPhysicalMaterial({
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
        roughness: 0.5,
        sheen: 0.3,
      }),
      nucleus: new MeshPhysicalMaterial({
        clearcoat: 0.5,
        color: FLORA_COLORS.nucleusStain,
        roughness: 0.4,
      }),
      vacuole: new MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        color: FLORA_COLORS.vacuoleSap,
        opacity: 0.78,
        roughness: 0.12,
        transparent: true,
      }),
      wall: new MeshPhysicalMaterial({
        color: FLORA_COLORS.cellWall,
        roughness: 0.72,
      }),
    };
    return {
      ball,
      box,
      materials,
      meshes: cellsOf({ ball, box, cells, depth, materials, tones }),
    };
  }, [cells, depth, tones]);

  useEffect(
    () => () => {
      built.ball.dispose();
      built.box.dispose();
      built.materials.body.dispose();
      built.materials.nucleus.dispose();
      built.materials.vacuole.dispose();
      built.materials.wall.dispose();
      built.meshes.bodies.dispose();
      built.meshes.nuclei.dispose();
      built.meshes.vacuoles.dispose();
      built.meshes.walls.dispose();
    },
    [built]
  );

  return (
    <group>
      <primitive object={built.meshes.walls} />
      <primitive object={built.meshes.bodies} />
      <primitive object={built.meshes.nuclei} />
      <primitive object={built.meshes.vacuoles} />
    </group>
  );
}

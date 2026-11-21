import { useFrame } from "@react-three/fiber";
import {
  ARTERIOLE_PATH,
  arterioleRadius,
  MICRONS,
  VENULE,
  VENULE_PATH,
  venuleRadius,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { ERYTHROCYTE } from "@repo/design-system/components/contents/biology/capillary/erythrocyte";
import {
  placeCell,
  SPEED,
  useCellMaterial,
  useFlowTime,
  useRedCell,
  useScratch,
} from "@repo/design-system/components/contents/biology/capillary/flow";
import { WhiteCells } from "@repo/design-system/components/contents/biology/capillary/leukocyte";
import { CapillaryCells } from "@repo/design-system/components/contents/biology/capillary/parachute";
import type { Axis } from "@repo/design-system/components/contents/biology/capillary/sweep";
import {
  radiusOn,
  useAxis,
} from "@repo/design-system/components/contents/biology/capillary/sweep";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { Color } from "three";

/** The red cell's widest reach from its centre, in scene units: it never comes nearer another than twice this. */
const REACH = ERYTHROCYTE.radius / MICRONS;

/** The angles round the venule, from straight up, where its rings of red cells run; the lowest stretch is left to the rolling white cells. */
const VENULE_RING = [
  0,
  Math.PI - 2.3,
  Math.PI - 1.15,
  Math.PI + 1.15,
  Math.PI + 2.3,
];

/** The venule's wall thickness, in scene units. */
const VENULE_WALL_THICKNESS = VENULE.wall / MICRONS;

/** The blood: red cells in all three kinds of vessel, two white cells rolling along the venule, and plasma protein. */
export function Blood() {
  const arteriole = useAxis(ARTERIOLE_PATH, arterioleRadius, 420, true);
  const venule = useAxis(VENULE_PATH, venuleRadius, 420, true);
  return (
    <group>
      <ArterialCells axis={arteriole} />
      <VenousCells axis={venule} />
      <CapillaryCells />
      <WhiteCells axis={venule} />
    </group>
  );
}

/** The arteriole's red cells, three abreast, flowing in through its cut front; deeper in, its muscular wall hides them. */
function ArterialCells({ axis }: { readonly axis: Axis }) {
  const disc = useRedCell();
  const material = useCellMaterial();
  const mesh = useRef<InstancedMesh>(null);
  const time = useFlowTime(4);
  const scratch = useScratch();
  const reach = 0.42 * axis.length;
  const slices = Math.floor(reach / 0.85);
  const count = slices * 3;
  useEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const color = new Color(CAPILLARY_COLORS.arterialCell);
    Arr.forEach(Arr.range(0, count - 1), (index) =>
      target.setColorAt(index, color)
    );
  }, [count]);
  useFrame(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    Arr.forEach(Arr.range(0, count - 1), (index) => {
      const slice = Math.floor(index / 3);
      const run =
        ((slice / slices) * reach + time.current * SPEED.arteriole) % reach;
      const angle = ((index % 3) * Math.PI * 2) / 3 + slice * 0.9;
      placeCell(
        scratch,
        axis,
        run / axis.length,
        0.55,
        angle,
        index,
        time.current
      );
      target.setMatrixAt(index, scratch.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      args={[disc, material, count]}
      castShadow
      frustumCulled={false}
      ref={mesh}
    />
  );
}

/** The venule's red cells: in single file where it is still narrow, then in rings round its wide lumen. */
function VenousCells({ axis }: { readonly axis: Axis }) {
  const disc = useRedCell();
  const material = useCellMaterial();
  const mesh = useRef<InstancedMesh>(null);
  const time = useFlowTime(2);
  const scratch = useScratch();
  const slices = Math.floor(axis.length / 0.85);
  const count = slices * VENULE_RING.length;
  useEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const color = new Color(CAPILLARY_COLORS.venousCell);
    Arr.forEach(Arr.range(0, count - 1), (index) =>
      target.setColorAt(index, color)
    );
  }, [count]);
  useFrame(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    Arr.forEach(Arr.range(0, count - 1), (index) => {
      const slice = Math.floor(index / VENULE_RING.length);
      const place = index % VENULE_RING.length;
      const run =
        ((slice / slices) * axis.length + time.current * SPEED.venule) %
        axis.length;
      const along = run / axis.length;
      const lumen = radiusOn(axis, along) - VENULE_WALL_THICKNESS;
      const wide = lumen >= 1.05 + REACH;
      const fits = wide || (place === 0 && lumen >= REACH + 0.04);
      placeCell(
        scratch,
        axis,
        along,
        wide ? 1.05 : 0,
        VENULE_RING[place] ?? 0,
        index,
        time.current
      );
      if (!fits) {
        scratch.matrix.makeScale(0, 0, 0);
      }
      target.setMatrixAt(index, scratch.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      args={[disc, material, count]}
      castShadow
      frustumCulled={false}
      ref={mesh}
    />
  );
}

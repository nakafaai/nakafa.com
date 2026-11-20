import { useFrame } from "@react-three/fiber";
import type { Point } from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  CAPILLARIES,
  CAPILLARY,
  inner,
  MICRONS,
  outer,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  SPEED,
  useCellMaterial,
  useFlowTime,
  useRedCell,
  useScratch,
} from "@repo/design-system/components/contents/biology/capillary/flow";
import {
  directionOn,
  pointOn,
  useAxis,
} from "@repo/design-system/components/contents/biology/capillary/sweep";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { InstancedMesh, LatheGeometry } from "three";
import { Color } from "three";

/** The capillaries' red cells, each bent into a parachute, passing in single file and darkening as they give up oxygen. */
export function CapillaryCells() {
  const parachute = useRedCell(inner(CAPILLARY) * MICRONS - 0.35);
  return (
    <group>
      {Arr.map(CAPILLARIES, (capillary, index) => (
        <CapillaryFile
          geometry={parachute}
          index={index}
          key={capillary.name}
          path={capillary.path}
        />
      ))}
    </group>
  );
}

/** A capillary's radius: the same all along. */
function capillaryRadius() {
  return outer(CAPILLARY);
}

/** The red cells and plasma protein of one capillary. */
function CapillaryFile({
  geometry,
  index,
  path,
}: {
  readonly geometry: LatheGeometry;
  readonly index: number;
  readonly path: readonly Point[];
}) {
  const axis = useAxis(
    path,
    capillaryRadius,
    Math.round(path.length * 60),
    true
  );
  const material = useCellMaterial();
  const cells = useRef<InstancedMesh>(null);
  const proteins = useRef<InstancedMesh>(null);
  const time = useFlowTime(3 + index);
  const scratch = useScratch();
  const crossLink = index === CAPILLARIES.length - 1;
  const gaps = useMemo(() => {
    const raw = Arr.map(
      Arr.range(0, Math.floor(axis.length / (crossLink ? 2.2 : 1.35)) - 1),
      (cell) => 1 + 0.7 * hashUnit(cell, index + 11)
    );
    const total = Arr.reduce(raw, 0, (sum, gap) => sum + gap);
    return Arr.map(raw, (gap) => (gap / total) * axis.length);
  }, [axis.length, crossLink, index]);
  const starts = useMemo(
    () => Arr.scan(gaps, 0, (run, gap) => run + gap),
    [gaps]
  );
  const arterial = useMemo(() => new Color(CAPILLARY_COLORS.arterialCell), []);
  const venous = useMemo(() => new Color(CAPILLARY_COLORS.venousCell), []);
  const tint = useMemo(() => new Color(), []);
  useFrame(() => {
    const red = cells.current;
    const plasma = proteins.current;
    if (red === null || plasma === null) {
      return;
    }
    Arr.forEach(gaps, (gap, cell) => {
      const run =
        ((starts[cell] ?? 0) + time.current * SPEED.capillary) % axis.length;
      const along = run / axis.length;
      const hidden = run > axis.length - 0.3;
      pointOn(axis, along, 0, 0, scratch.point);
      directionOn(axis, along, scratch.direction);
      scratch.turn.setFromUnitVectors(scratch.up, scratch.direction);
      scratch.matrix.compose(scratch.point, scratch.turn, scratch.scale);
      if (hidden) {
        scratch.matrix.makeScale(0, 0, 0);
      }
      red.setMatrixAt(cell, scratch.matrix);
      red.setColorAt(
        cell,
        tint.copy(arterial).lerp(venous, crossLink ? 0.5 : along)
      );
      const middle = (run + gap / 2) % axis.length;
      pointOn(axis, middle / axis.length, 0.12, cell * 2.1, scratch.point);
      scratch.matrix.makeTranslation(scratch.point);
      plasma.setMatrixAt(cell, scratch.matrix);
    });
    red.instanceMatrix.needsUpdate = true;
    plasma.instanceMatrix.needsUpdate = true;
    if (red.instanceColor !== null) {
      red.instanceColor.needsUpdate = true;
    }
  });
  return (
    <group>
      <instancedMesh
        args={[geometry, material, gaps.length]}
        castShadow
        frustumCulled={false}
        ref={cells}
      />
      <instancedMesh
        args={[undefined, undefined, gaps.length]}
        frustumCulled={false}
        ref={proteins}
      >
        <icosahedronGeometry args={[0.065, 1]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={CAPILLARY_COLORS.protein}
          emissive={CAPILLARY_COLORS.protein}
          emissiveIntensity={0.25}
          roughness={0.35}
        />
      </instancedMesh>
    </group>
  );
}

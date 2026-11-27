import { PLACES } from "@repo/design-system/components/contents/biology/equipment/places";
import {
  ColumnLiquid,
  Flask,
  FlaskLiquid,
} from "@repo/design-system/components/contents/chemistry/bench";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Turn } from "@repo/design-system/components/three/form/part";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useLayoutEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

/** A 250 mL low-form beaker, 70 mm across and 95 mm tall, its outline from base to rim. */
const BEAKER = [
  [0, 0],
  [0.033, 0],
  [0.035, 0.003],
  [0.035, 0.093],
  [0.0362, 0.095],
] as const;

/** How high 50 mL stands in the beaker: its volume over the inside's cross-section, 33.5 mm in radius. */
const BEAKER_FIFTY = 5e-5 / (Math.PI * 0.0335 ** 2);

/** The beaker, printed with a white scale every 50 mL, holding 150 mL of water. */
export function Beaker() {
  return (
    <group position={PLACES.beaker.base}>
      <mesh castShadow>
        <Turn profile={BEAKER} spout wall={[0.0015, 0.003]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
      </mesh>
      {Arr.map(Arr.range(1, 4), (step) => (
        <mesh
          key={step}
          position={[0, 0.003 + step * BEAKER_FIFTY, 0]}
          rotation={[Math.PI / 2, 0, 0.6]}
        >
          <torusGeometry
            args={[0.0353, 0.000_45, 4, 10, step % 2 === 0 ? 0.42 : 0.26]}
          />
          <meshStandardMaterial
            color={LABORATORY_COLORS.frost}
            roughness={0.6}
          />
        </mesh>
      ))}
      <ColumnLiquid
        bottom={0.0032}
        color={LABORATORY_COLORS.water}
        level={0.003 + 3 * BEAKER_FIFTY}
        opacity={0.4}
        radius={0.0333}
      />
    </group>
  );
}

/** A 250 mL conical flask holding pale blue copper(II) sulfate solution. */
export function ConicalFlask() {
  return (
    <group position={PLACES.conicalFlask.base}>
      <Flask />
      <FlaskLiquid
        color={LABORATORY_COLORS.copperSulfate}
        level={0.032}
        opacity={0.62}
      />
    </group>
  );
}

/** A 100 mL measuring cylinder's glass tube, 29 mm across, from its hexagonal foot to the spouted rim. */
const CYLINDER = [
  [0, 0.008],
  [0.0145, 0.008],
  [0.0145, 0.252],
  [0.0153, 0.255],
  [0.0158, 0.256],
] as const;

/** How high 1 mL stands in the cylinder: its volume over the inside's cross-section, 13 mm in radius. */
const MILLILITRE = 1e-6 / (Math.PI * 0.013 ** 2);

/** Where the cylinder's scale starts, at its inside bottom. */
const CYLINDER_FLOOR = 0.0105;

/** The scale's ticks round the front of the cylinder: short every 2 mL, longer every 10 mL. */
function CylinderTicks({ long }: { readonly long: boolean }) {
  const ticks = useRef<InstancedMesh>(null);
  const arc = long ? 0.62 : 0.34;
  const marks = Arr.filter(
    Arr.range(1, 50),
    (mark) => (mark % 5 === 0) === long
  );
  useLayoutEffect(() => {
    const mesh = ticks.current;
    if (mesh === null) {
      return;
    }
    const turn = new Quaternion().setFromEuler(
      new Euler(Math.PI / 2, 0, Math.PI / 2 - 0.31)
    );
    const matrix = new Matrix4();
    const place = new Vector3();
    const scale = new Vector3(1, 1, 1);
    for (const [index, mark] of Arr.zip(
      Arr.range(0, marks.length - 1),
      marks
    )) {
      place.set(0, CYLINDER_FLOOR + mark * 2 * MILLILITRE, 0);
      mesh.setMatrixAt(index, matrix.compose(place, turn, scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  return (
    <instancedMesh args={[undefined, undefined, marks.length]} ref={ticks}>
      <torusGeometry args={[0.014_65, 0.000_28, 3, 6, arc]} />
      <meshBasicMaterial color={LABORATORY_COLORS.frost} />
    </instancedMesh>
  );
}

/** The measuring cylinder: a hexagonal foot, a scale ticked every 2 mL and longer every 10, and 62 mL of water. */
export function MeasuringCylinder() {
  return (
    <group position={PLACES.measuringCylinder.base} rotation={[0, 0.5, 0]}>
      <mesh castShadow position={[0, 0.004, 0]}>
        <cylinderGeometry args={[0.0375, 0.0375, 0.008, 6]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.42} />
      </mesh>
      <mesh castShadow>
        <Turn profile={CYLINDER} spout wall={[0.0015, 0.0025]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.24} />
      </mesh>
      <CylinderTicks long={false} />
      <CylinderTicks long />
      <ColumnLiquid
        bottom={CYLINDER_FLOOR}
        color={LABORATORY_COLORS.water}
        level={CYLINDER_FLOOR + 62 * MILLILITRE}
        opacity={0.42}
        radius={0.0129}
      />
    </group>
  );
}

/** How many colonies grow along the streaks on the agar. */
const COLONIES = 46;

/**
 * A 90 mm Petri dish of nutrient agar, streaked in three zones so the last
 * zone grows single colonies, its lid held on by two short strips of tape.
 */
export function PetriDish() {
  const colonies = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = colonies.current;
    if (mesh === null) {
      return;
    }
    const matrix = new Matrix4();
    for (const index of Arr.range(0, COLONIES - 1)) {
      const zone = Math.min(2, Math.floor(index / 16));
      const along = hashUnit(index, 5) - 0.5;
      const angle = zone * 2.1 + along * 1.1;
      const reach = 0.016 + hashUnit(index, 9) * 0.018;
      const size =
        0.0007 + hashUnit(index, 13) * (zone === 2 ? 0.0016 : 0.0007);
      matrix
        .makeScale(size, size * 0.35, size)
        .setPosition(Math.cos(angle) * reach, 0.0072, Math.sin(angle) * reach);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  return (
    <group position={PLACES.petriDish.base}>
      <mesh castShadow position={[0, 0.0068, 0]}>
        <cylinderGeometry args={[0.0425, 0.0425, 0.0135, 64, 1, true]} />
        <GlassMaterial color={LABORATORY_COLORS.polystyrene} opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.0006, 0]}>
        <cylinderGeometry args={[0.0425, 0.0425, 0.0012, 64]} />
        <GlassMaterial color={LABORATORY_COLORS.polystyrene} opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.0042, 0]} receiveShadow>
        <cylinderGeometry args={[0.0418, 0.0418, 0.006, 64]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          clearcoatRoughness={0.15}
          color={LABORATORY_COLORS.agar}
          opacity={0.88}
          roughness={0.3}
          transparent
        />
      </mesh>
      <instancedMesh args={[undefined, undefined, COLONIES]} ref={colonies}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={LABORATORY_COLORS.colony}
          roughness={0.4}
        />
      </instancedMesh>
      <mesh castShadow position={[0, 0.0105, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.009, 64, 1, true]} />
        <GlassMaterial color={LABORATORY_COLORS.polystyrene} opacity={0.24} />
      </mesh>
      <mesh position={[0, 0.0148, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.0009, 64]} />
        <GlassMaterial color={LABORATORY_COLORS.polystyrene} opacity={0.2} />
      </mesh>
      {Arr.map([0.6, 3.74] as const, (angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh position={[0.0405, 0.0154, 0]}>
            <boxGeometry args={[0.012, 0.0003, 0.019]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.tape}
              roughness={0.8}
            />
          </mesh>
          <mesh position={[0.0453, 0.0105, 0]}>
            <boxGeometry args={[0.0003, 0.008, 0.019]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.tape}
              roughness={0.8}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

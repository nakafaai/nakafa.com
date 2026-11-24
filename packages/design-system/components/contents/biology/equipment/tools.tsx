import { RoundedBox } from "@react-three/drei";
import { GAS_TAP } from "@repo/design-system/components/contents/biology/equipment/bench";
import { PLACES } from "@repo/design-system/components/contents/biology/equipment/places";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { CatmullRomCurve3, Matrix4, Vector2, Vector3 } from "three";

/** The Bunsen burner's cast foot, turned round its axis: 85 mm across, rising to the barrel's socket. */
const BURNER_FOOT = Arr.map(
  [
    [0.001, 0],
    [0.0425, 0],
    [0.0425, 0.005],
    [0.037, 0.011],
    [0.015, 0.021],
    [0.0095, 0.026],
    [0.001, 0.026],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** How high the burner's gas inlet stands above its foot, and how far back its serrated nozzle reaches. */
const INLET = { height: 0.014, reach: 0.062 } as const;

/**
 * A Bunsen burner on its heat-resistant mat under the tripod: a cast foot, a
 * gas inlet at the back, a collar with its air hole, and a 13 mm brass
 * barrel, 130 mm tall in all. The orange rubber tubing runs back to the gas
 * tap. Its flame is out: a lit burner is never left unattended.
 */
export function BunsenBurner() {
  const { base } = PLACES.bunsenBurner;
  const hose = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(GAS_TAP[0], GAS_TAP[1] + 0.06, GAS_TAP[2] + 0.035),
        new Vector3(GAS_TAP[0] + 0.004, GAS_TAP[1] + 0.04, GAS_TAP[2] + 0.065),
        new Vector3(base[0] + 0.01, GAS_TAP[1] + 0.0064, -0.605),
        new Vector3(base[0] + 0.008, base[1] + 0.0066, -0.55),
        new Vector3(
          base[0] + 0.002,
          base[1] + INLET.height - 0.001,
          base[2] - INLET.reach - 0.02
        ),
        new Vector3(
          base[0],
          base[1] + INLET.height,
          base[2] - INLET.reach + 0.006
        ),
      ]),
    [base]
  );
  return (
    <group>
      <RoundedBox
        args={[0.25, 0.006, 0.25]}
        position={[base[0], base[1] - 0.003, base[2]]}
        radius={0.0025}
        receiveShadow
      >
        <meshStandardMaterial color={LABORATORY_COLORS.mat} roughness={0.95} />
      </RoundedBox>
      <mesh castShadow>
        <tubeGeometry args={[hose, 64, 0.0062, 14, false]} />
        <meshPhysicalMaterial
          clearcoat={0.25}
          color={LABORATORY_COLORS.tubing}
          roughness={0.55}
        />
      </mesh>
      <group position={base}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[BURNER_FOOT, 48]} />
          <meshPhysicalMaterial
            color={LABORATORY_COLORS.burnerBase}
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
        <mesh
          castShadow
          position={[0, INLET.height, -INLET.reach / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.0042, 0.0048, INLET.reach, 16]} />
          <MetalMaterial color={LABORATORY_COLORS.brass} roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 0.035, 0]}>
          <cylinderGeometry args={[0.0088, 0.0088, 0.018, 32]} />
          <MetalMaterial color={LABORATORY_COLORS.brass} roughness={0.28} />
        </mesh>
        <mesh
          position={[0.0071, 0.035, 0.0053]}
          rotation={[0, -0.6435, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0032, 0.0032, 0.0006, 20]} />
          <meshBasicMaterial color={LABORATORY_COLORS.burnerBase} />
        </mesh>
        <mesh castShadow position={[0, 0.085, 0]}>
          <cylinderGeometry args={[0.0065, 0.0065, 0.09, 32, 1, true]} />
          <MetalMaterial color={LABORATORY_COLORS.brass} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0062, 0.0007, 8, 32]} />
          <MetalMaterial color={LABORATORY_COLORS.brass} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

/** The tripod's three legs, one towards the learner and two behind, by their angle round the ring. */
const LEGS = Arr.map(Arr.range(0, 2), (index) => (index * Math.PI * 2) / 3);

/** The tripod's ring radius and its feet's spread, in metres: a ring about 150 mm across on splayed legs. */
const TRIPOD = { foot: 0.1, height: 0.22, ring: 0.075 } as const;

/** How many wires cross the gauze each way. */
const WIRES = 24;

/**
 * An iron tripod 220 mm tall over the burner, with a 150 mm square wire gauze
 * on its ring and the gauze's 90 mm ceramic centre, which spreads the heat.
 */
export function Tripod() {
  const wires = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = wires.current;
    if (mesh === null) {
      return;
    }
    const matrix = new Matrix4();
    for (const index of Arr.range(0, 2 * WIRES - 1)) {
      const across = index >= WIRES;
      const offset = -0.0725 + ((index % WIRES) * 0.145) / (WIRES - 1);
      matrix
        .makeRotationY(across ? Math.PI / 2 : 0)
        .setPosition(
          across ? 0 : offset,
          across ? 0.0006 : 0,
          across ? offset : 0
        );
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  return (
    <group position={PLACES.tripod.base}>
      <mesh
        castShadow
        position={[0, TRIPOD.height - 0.004, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[TRIPOD.ring, 0.004, 10, 48]} />
        <MetalMaterial color={LABORATORY_COLORS.iron} roughness={0.55} />
      </mesh>
      {Arr.map(LEGS, (angle) => (
        <TripodLeg angle={angle} key={angle} />
      ))}
      <group position={[0, TRIPOD.height + 0.0004, 0]}>
        <instancedMesh
          args={[undefined, undefined, 2 * WIRES]}
          castShadow
          ref={wires}
        >
          <boxGeometry args={[0.0007, 0.0007, 0.15]} />
          <MetalMaterial color={LABORATORY_COLORS.gauzeWire} roughness={0.5} />
        </instancedMesh>
        <mesh castShadow position={[0, 0.0016, 0]} receiveShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.0018, 48]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.ceramic}
            roughness={0.95}
          />
        </mesh>
      </group>
    </group>
  );
}

/** One of the tripod's legs, from under its ring down and out to its foot on the mat. */
function TripodLeg({ angle }: { readonly angle: number }) {
  const top = new Vector3(
    Math.sin(angle) * TRIPOD.ring,
    TRIPOD.height - 0.006,
    Math.cos(angle) * TRIPOD.ring
  );
  const foot = new Vector3(
    Math.sin(angle) * TRIPOD.foot,
    0.003,
    Math.cos(angle) * TRIPOD.foot
  );
  const direction = foot.clone().sub(top);
  const length = direction.length();
  const middle = top.clone().add(foot).multiplyScalar(0.5);
  const tilt = Math.acos(-direction.y / length);
  return (
    <group position={middle} rotation={[0, angle, 0]}>
      <mesh castShadow rotation={[-tilt, 0, 0]}>
        <cylinderGeometry args={[0.0035, 0.0035, length, 12]} />
        <MetalMaterial color={LABORATORY_COLORS.iron} roughness={0.55} />
      </mesh>
    </group>
  );
}

/**
 * A disposable inoculating loop, 200 mm of blue polystyrene with a 10 µL loop
 * at one end and a needle at the other, lying beside the Petri dish.
 */
export function InoculatingLoop() {
  const { base, size } = PLACES.inoculatingLoop;
  return (
    <group
      position={[base[0], base[1] + 0.0016, base[2]]}
      rotation={[0, 0.08, 0]}
    >
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0016, 0.0016, size[2] - 0.012, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={LABORATORY_COLORS.loop}
          roughness={0.35}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, -0.001, size[2] / 2 - 0.0035]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.0022, 0.0006, 8, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={LABORATORY_COLORS.loop}
          roughness={0.35}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, 0, -size[2] / 2 + 0.003]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <coneGeometry args={[0.0012, 0.006, 10]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={LABORATORY_COLORS.loop}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

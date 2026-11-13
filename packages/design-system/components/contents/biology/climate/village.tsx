import {
  groundAt,
  houseSpot,
  VILLAGE,
} from "@repo/design-system/components/contents/biology/climate/sea";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo, useRef } from "react";
import { DoubleSide, type InstancedMesh, Object3D, PlaneGeometry } from "three";

/** The beach runs from 60 m out to sea to 70 m inland, and 80 m along the coast. */
const SHORE = { inland: 70, length: 80, sea: -60 } as const;

/**
 * The sloping ground: wet sand that runs down under the sea, dry sand at the
 * top of the beach, and grass inland where the village stands.
 */
export function Beach() {
  const sand = useMemo(() => slopedPlane(SHORE.sea, 18), []);
  const grass = useMemo(() => slopedPlane(18, SHORE.inland), []);
  return (
    <group>
      <mesh geometry={sand} receiveShadow>
        <meshStandardMaterial color={MATERIAL.sand} roughness={0.95} />
      </mesh>
      <mesh geometry={grass} receiveShadow>
        <meshStandardMaterial color={MATERIAL.grass} roughness={1} />
      </mesh>
    </group>
  );
}

/** A plane from `from` to `to` metres inland that follows the beach's slope. */
function slopedPlane(from: number, to: number) {
  const plane = new PlaneGeometry(to - from, SHORE.length, 48, 24);
  plane.rotateX(-Math.PI / 2);
  plane.translate((from + to) / 2, 0, 0);
  const positions = plane.attributes.position;
  if (positions) {
    Arr.forEach(Arr.range(0, positions.count - 1), (index) => {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      positions.setY(
        index,
        groundAt(x) +
          (hashUnit(Math.round(x * 3), Math.round(z * 3)) - 0.5) * 0.04
      );
    });
  }
  plane.computeVertexNormals();
  return plane;
}

/** A village house: plastered walls, a zinc roof, a door and two windows. */
export function House({
  index,
  wet,
}: {
  readonly index: number;
  readonly wet: boolean;
}) {
  const floor = VILLAGE.floors[index] ?? 0;
  const [x, y, z] = houseSpot(index, floor);
  return (
    <group
      position={[x, y, z]}
      rotation={[0, (hashUnit(index, 9) - 0.5) * 0.3, 0]}
    >
      <mesh castShadow position={[0, 1.4, 0]} receiveShadow>
        <boxGeometry args={[5, 2.8, 6]} />
        <meshStandardMaterial
          color={wet ? MATERIAL.mud : MATERIAL.stucco}
          roughness={0.9}
        />
      </mesh>
      {Arr.map([-1, 1], (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * 1.3, 3.35, 0]}
          rotation={[0, 0, -side * 0.5]}
        >
          <boxGeometry args={[3, 0.06, 6.6]} />
          <meshStandardMaterial
            color={MATERIAL.roofZinc}
            metalness={0.6}
            roughness={0.45}
          />
        </mesh>
      ))}
      <mesh position={[-2.51, 1, 0]}>
        <boxGeometry args={[0.05, 2, 1]} />
        <meshStandardMaterial color={MATERIAL.timber} roughness={0.8} />
      </mesh>
      {Arr.map([-1.8, 1.8], (offset) => (
        <mesh key={offset} position={[-2.51, 1.6, offset]}>
          <boxGeometry args={[0.05, 0.8, 0.9]} />
          <meshStandardMaterial color={MATERIAL.tintedGlass} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A tide gauge at the old high-tide line: a post painted in 10 cm bands
 * from 0.5 m below it to 2.5 m above it.
 */
export function TideGauge() {
  return (
    <group position={[0, 0, 0]}>
      {Arr.map(Arr.range(0, 29), (band) => (
        <mesh castShadow key={band} position={[0, band * 0.1 + 0.05 - 0.5, 0]}>
          <boxGeometry args={[0.4, 0.1, 0.4]} />
          <meshStandardMaterial
            color={band % 2 === 0 ? getColor("SLATE", 50) : MATERIAL.calx}
            roughness={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A concrete sea wall along the coast, its crest 2.5 m above today's high tide. */
export function SeaWall() {
  const x = 4;
  const base = groundAt(x) - 0.6;
  const height = VILLAGE.wall - base;
  return (
    <mesh castShadow position={[x, base + height / 2, 0]} receiveShadow>
      <boxGeometry args={[1.2, height, SHORE.length]} />
      <meshStandardMaterial color={MATERIAL.concrete} roughness={0.85} />
    </mesh>
  );
}

/**
 * A belt of mangroves on the mudflat in front of the beach: each tree a
 * spread of arching prop roots under a rounded crown.
 */
export function Mangroves() {
  const count = 140;
  const crowns = useRef<InstancedMesh>(null);
  const roots = useRef<InstancedMesh>(null);
  const holder = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    Arr.forEach(Arr.range(0, count - 1), (tree) => {
      const x = -4 - hashUnit(tree, 1) * 54;
      const z = (hashUnit(tree, 2) - 0.5) * SHORE.length;
      const size = 0.8 + hashUnit(tree, 3) * 0.5;
      holder.position.set(x, groundAt(x) + 3.4 * size, z);
      holder.scale.set(2.4 * size, 1.5 * size, 2.4 * size);
      holder.updateMatrix();
      crowns.current?.setMatrixAt(tree, holder.matrix);
      holder.position.set(x, groundAt(x) + 0.9 * size, z);
      holder.scale.set(1.3 * size, 1.1 * size, 1.3 * size);
      holder.updateMatrix();
      roots.current?.setMatrixAt(tree, holder.matrix);
    });
    if (crowns.current && roots.current) {
      crowns.current.instanceMatrix.needsUpdate = true;
      roots.current.instanceMatrix.needsUpdate = true;
    }
  }, [holder]);

  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, count]}
        castShadow
        ref={crowns}
      >
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={MATERIAL.foliageDark} roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, count]}
        castShadow
        ref={roots}
      >
        <coneGeometry args={[1, 2.4, 7, 1, true]} />
        <meshStandardMaterial
          color={MATERIAL.mangroveRoot}
          roughness={0.95}
          side={DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}

/** The sea, a wide sheet of water whose surface stands at `level` metres. */
export function Sea({ level }: { readonly level: number }) {
  return (
    <mesh
      position={[SHORE.sea / 2 - 100, level, 0]}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[420, 300]} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.1}
        color={MATERIAL.seawater}
        opacity={0.9}
        roughness={0.12}
        transparent
      />
    </mesh>
  );
}

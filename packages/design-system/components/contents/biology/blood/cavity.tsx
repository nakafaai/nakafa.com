import { useFrame } from "@react-three/fiber";
import { useRunClock } from "@repo/design-system/components/contents/biology/blood/clock";
import {
  BLOOD_RELEASES,
  clumpingAt,
  FINISH,
  fallTime,
  mixAt,
  SERUM_RELEASES,
  spreadAt,
} from "@repo/design-system/components/contents/biology/blood/run";
import type { Serum } from "@repo/design-system/components/contents/biology/blood/serology";
import {
  columnX,
  DROP,
  floorAt,
  gatherAt,
  grainsOf,
  poolDepth,
  poolRadius,
  rowZ,
  TILE,
  TIP_HEIGHT,
} from "@repo/design-system/components/contents/biology/blood/well";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SEROLOGY_COLORS } from "@repo/design-system/lib/material/serology";
import { useEffect, useMemo, useRef } from "react";
import type {
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
} from "three";
import {
  Color,
  Object3D,
  MeshPhysicalMaterial as PhysicalMaterial,
} from "three";

/** The tint of each serum as it pools on the tile. */
const SERUM_TINT = {
  a: SEROLOGY_COLORS.antiA,
  b: SEROLOGY_COLORS.antiB,
  d: SEROLOGY_COLORS.antiD,
} as const satisfies Record<Serum, string>;

/** How opaque each serum's pool is: the dyed sera deeply, anti-D only as a clear film. */
const SERUM_OPACITY = { a: 0.82, b: 0.8, d: 0.45 } as const satisfies Record<
  Serum,
  number
>;

/** A matrix-builder reused for every grain of every frame. */
const GRAIN = new Object3D();

/**
 * One cavity in use: the serum dropped into it, the blood dropped onto the serum,
 * the two stirred together, and then either an even red suspension or red
 * cells gathering into clumps in a clearing fluid.
 */
export function Cavity({
  active,
  column,
  grain,
  mixed,
  positive,
  row,
  serum,
  serumPool,
}: {
  readonly active: boolean;
  readonly column: number;
  readonly grain: IcosahedronGeometry;
  readonly mixed: LatheGeometry;
  readonly positive: boolean;
  readonly row: number;
  readonly serum: Serum;
  readonly serumPool: LatheGeometry;
}) {
  const clock = useRunClock();
  const grains = useMemo(
    () =>
      positive
        ? grainsOf(row * 3 + column + 1, poolRadius(poolDepth(2 * DROP)))
        : [],
    [column, positive, row]
  );
  const looks = useMemo(
    () => ({
      blob: new PhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        color: SEROLOGY_COLORS.blood,
        depthWrite: false,
        roughness: 0.12,
        transparent: true,
        vertexColors: true,
      }),
      blood: new Color(SEROLOGY_COLORS.blood),
      clump: new PhysicalMaterial({
        clearcoat: 0.15,
        clearcoatRoughness: 0.35,
        color: SEROLOGY_COLORS.clump,
        envMapIntensity: 0.08,
        roughness: 0.55,
        specularIntensity: 0.35,
      }),
      fluid: new Color(SERUM_TINT[serum]).lerp(
        new Color(SEROLOGY_COLORS.plasma),
        serum === "d" ? 0.85 : 0.5
      ),
      pool: new PhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        color: SERUM_TINT[serum],
        depthWrite: false,
        ior: 1.35,
        roughness: 0.08,
        transparent: true,
        vertexColors: true,
      }),
      serum: new Color(SERUM_TINT[serum]),
    }),
    [serum]
  );
  useEffect(
    () => () => {
      looks.blob.dispose();
      looks.clump.dispose();
      looks.pool.dispose();
    },
    [looks]
  );
  const serumMesh = useRef<Mesh>(null);
  const mixedMesh = useRef<Mesh>(null);
  const blobMesh = useRef<Mesh>(null);
  const clumps = useRef<InstancedMesh>(null);
  const shown = useRef(Number.NaN);

  useFrame(() => {
    const time = active ? clock.current : FINISH;
    if (time === shown.current) {
      return;
    }
    shown.current = time;
    showWell(time);
  });

  function showWell(time: number) {
    const fall = fallTime(TIP_HEIGHT);
    const serumIn = spreadAt(time, SERUM_RELEASES[column] + fall);
    const bloodIn = spreadAt(time, BLOOD_RELEASES[column] + fall);
    const mix = mixAt(time, column);
    const clumping = positive ? clumpingAt(time, column) : 0;
    const free = 1 - clumping;
    const pool = looks.pool;
    if (serumMesh.current) {
      const spread = 0.35 + 0.65 * serumIn;
      serumMesh.current.scale.set(spread, 1, spread);
      serumMesh.current.visible = serumIn > 0 && bloodIn === 0;
    }
    if (mixedMesh.current) {
      mixedMesh.current.visible = bloodIn > 0;
    }
    if (blobMesh.current) {
      blobMesh.current.visible = bloodIn > 0 && mix < 1;
      const spread = (0.25 + 0.75 * bloodIn) * (0.55 + 0.45 * mix);
      blobMesh.current.scale.set(spread, 1, spread);
    }
    looks.blob.opacity = 1 - mix * mix;
    if (bloodIn === 0) {
      pool.color.copy(looks.serum);
      pool.opacity = SERUM_OPACITY[serum];
    } else {
      pool.color.copy(looks.serum).lerp(looks.blood, mix);
      pool.opacity = SERUM_OPACITY[serum] + (1 - SERUM_OPACITY[serum]) * mix;
      if (clumping > 0) {
        pool.color.copy(looks.fluid).lerp(looks.blood, free ** 1.6);
        pool.opacity = 0.1 + 0.9 * free ** 0.8;
      }
    }
    const instances = clumps.current;
    if (instances === null) {
      return;
    }
    for (let index = 0; index < grains.length; index += 1) {
      const each = grains[index];
      const gather = gatherAt(clumping, each.join);
      const size = clumping > 0 ? each.radius * (0.3 + 0.7 * gather) : 0;
      const x = each.from[0] + (each.to[0] - each.from[0]) * gather;
      const z = each.from[1] + (each.to[1] - each.from[1]) * gather;
      GRAIN.position.set(x, -floorAt(Math.hypot(x, z)) + size * 0.3, z);
      GRAIN.rotation.set(0, hashUnit(index, row + column) * Math.PI * 2, 0);
      GRAIN.scale.set(size, size * 0.46, size * (0.8 + 0.4 * each.join));
      GRAIN.updateMatrix();
      instances.setMatrixAt(index, GRAIN.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
  }

  return (
    <group position={[columnX(column), TILE.height, rowZ(row)]}>
      <mesh
        geometry={serumPool}
        material={looks.pool}
        ref={serumMesh}
        renderOrder={2}
      />
      <mesh
        geometry={mixed}
        material={looks.pool}
        ref={mixedMesh}
        renderOrder={2}
      />
      <mesh
        geometry={mixed}
        material={looks.blob}
        position={[0, 0.000_04, 0]}
        ref={blobMesh}
        renderOrder={3}
      />
      {grains.length > 0 && (
        <instancedMesh
          args={[grain, looks.clump, grains.length]}
          castShadow
          ref={clumps}
        />
      )}
    </group>
  );
}

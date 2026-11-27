import {
  buildPlanterPotGeometry,
  buildSoilMoundGeometry,
} from "@repo/design-system/components/contents/biology/botanical";
import {
  useFoliageMaterial,
  useMossCushion,
} from "@repo/design-system/components/contents/biology/flora";
import { useHorizonFade } from "@repo/design-system/components/three/stage/terrain";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";

const PEBBLE_SLOTS = [
  {
    id: "pb1",
    pos: [-0.12, 0.015, 0.08] as const,
    r: 0.016,
    shade: SPECIMEN_COLORS.pebbleMid,
  },
  {
    id: "pb2",
    pos: [0.1, 0.014, 0.09] as const,
    r: 0.014,
    shade: SPECIMEN_COLORS.pebbleLight,
  },
  {
    id: "pb3",
    pos: [0.04, 0.016, -0.11] as const,
    r: 0.017,
    shade: SPECIMEN_COLORS.pebbleDark,
  },
  {
    id: "pb4",
    pos: [-0.08, 0.013, -0.09] as const,
    r: 0.013,
    shade: SPECIMEN_COLORS.pebbleWarm,
  },
] as const;

/**
 * Shared weathered terracotta botanical pot grounded at y = 0 with bumpy dark
 * organic peat/potting soil, velvety moss cushions, and mineral grit flecks.
 */
export function BotanicalPot({
  bottomRadius = 0.22,
  height = 0.27,
  mossy = true,
  seed = 7,
  topRadius = 0.29,
}: {
  readonly bottomRadius?: number;
  readonly height?: number;
  readonly mossy?: boolean;
  readonly seed?: number;
  readonly topRadius?: number;
}) {
  const { mound, pot } = useMemo(
    () => ({
      mound: buildSoilMoundGeometry(topRadius * 0.91, height * 0.22, seed),
      pot: buildPlanterPotGeometry(bottomRadius, topRadius, height),
    }),
    [bottomRadius, height, seed, topRadius]
  );
  const mossGeo = useMossCushion(seed + 11);
  const mossMat = useFoliageMaterial();

  useEffect(
    () => () => {
      pot.dispose();
      mound.dispose();
    },
    [mound, pot]
  );

  return (
    <group>
      <mesh castShadow geometry={pot} receiveShadow rotation={[0, Math.PI, 0]}>
        <SurfaceMaterial
          bump={0.48}
          color={BIOLOGY_COLORS.terracotta}
          repeat={[2, 1]}
          roughness={0.78}
          surface="concrete"
        />
      </mesh>
      <mesh
        castShadow
        geometry={mound}
        position={[0, height * 0.76, 0]}
        receiveShadow
      >
        <SurfaceMaterial
          bump={0.95}
          color={SPECIMEN_COLORS.soilPot}
          repeat={[3, 3]}
          roughness={0.96}
          surface="concrete"
        />
      </mesh>
      {mossy ? (
        <group position={[0, height * 0.93, 0]}>
          <mesh
            castShadow
            geometry={mossGeo}
            material={mossMat}
            position={[-topRadius * 0.34, 0, topRadius * 0.22]}
            scale={0.44}
          />
          <mesh
            castShadow
            geometry={mossGeo}
            material={mossMat}
            position={[topRadius * 0.3, 0, -topRadius * 0.18]}
            rotation={[0, 1.9, 0]}
            scale={0.38}
          />
        </group>
      ) : null}
      <group position={[0, height * 0.91, 0]}>
        {Arr.map(PEBBLE_SLOTS, (p) => (
          <mesh
            castShadow
            key={p.id}
            position={[p.pos[0], p.pos[1], p.pos[2]]}
            scale={[1.2, 0.65, 0.95]}
          >
            <dodecahedronGeometry args={[p.r, 0]} />
            <meshStandardMaterial color={p.shade} roughness={0.88} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Seamless horizon-faded dark organic botanical soil bed grounded at y = 0
 * with a sculpted root-collar mound, mossy tufts, and mineral pebbles.
 */
export function OrganicSoilBed({
  innerRadius = 0.65,
  moundHeight = 0.085,
  moundRadius = 0.44,
  outerRadius = 1.65,
  seed = 19,
}: {
  readonly innerRadius?: number;
  readonly moundHeight?: number;
  readonly moundRadius?: number;
  readonly outerRadius?: number;
  readonly seed?: number;
}) {
  const horizonFade = useHorizonFade(innerRadius, outerRadius);
  const mound = useMemo(
    () => buildSoilMoundGeometry(moundRadius, moundHeight, seed),
    [moundHeight, moundRadius, seed]
  );
  const mossGeo = useMossCushion(seed + 5);
  const mossMat = useFoliageMaterial();

  useEffect(() => () => mound.dispose(), [mound]);

  return (
    <group>
      <mesh
        position={[0, 0.002, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[outerRadius, 64]} />
        <meshStandardMaterial
          color={SPECIMEN_COLORS.soilBed}
          depthWrite
          ref={horizonFade}
          roughness={0.95}
          transparent
        />
      </mesh>
      <mesh castShadow geometry={mound} receiveShadow>
        <SurfaceMaterial
          bump={0.95}
          color={SPECIMEN_COLORS.soilMound}
          repeat={[4, 4]}
          roughness={0.96}
          surface="concrete"
        />
      </mesh>
      <mesh
        castShadow
        geometry={mossGeo}
        material={mossMat}
        position={[-moundRadius * 0.44, moundHeight * 0.76, moundRadius * 0.32]}
        scale={0.54}
      />
      <mesh
        castShadow
        geometry={mossGeo}
        material={mossMat}
        position={[moundRadius * 0.46, moundHeight * 0.72, -moundRadius * 0.28]}
        rotation={[0, 2.2, 0]}
        scale={0.46}
      />
      {Arr.map(PEBBLE_SLOTS, (p) => (
        <mesh
          castShadow
          key={p.id}
          position={[
            p.pos[0] * 1.9,
            p.pos[1] + moundHeight * 0.65,
            p.pos[2] * 1.9,
          ]}
          scale={[1.3, 0.65, 1]}
        >
          <dodecahedronGeometry args={[p.r * 1.25, 0]} />
          <meshStandardMaterial color={p.shade} roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

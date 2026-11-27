import { MonarchButterfly } from "@repo/design-system/components/contents/biology/butterfly";
import { useCuticleTextures } from "@repo/design-system/components/contents/biology/metamorphosis/cuticle";
import { useStageGeometries } from "@repo/design-system/components/contents/biology/metamorphosis/geometry";
import type { Insect } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

const EGG_CLUTCH = [
  {
    id: "e0",
    pos: [-0.04, 0.068, 0.015] as const,
    rot: [0.06, 0.2, 0.04] as const,
  },
  {
    id: "e1",
    pos: [0.065, 0.066, 0.055] as const,
    rot: [-0.05, 1.1, -0.06] as const,
  },
  {
    id: "e2",
    pos: [-0.115, 0.064, 0.05] as const,
    rot: [0.04, 2.1, 0.08] as const,
  },
  {
    id: "e3",
    pos: [0.015, 0.066, -0.068] as const,
    rot: [-0.08, 0.7, 0.04] as const,
  },
] as const;

const SPIRACLE_XS = [-0.16, -0.1, -0.04, 0.02, 0.08, 0.14] as const;
const PROLEG_XS = [-0.12, -0.06, 0, 0.06] as const;
const GOLD_CROWN_ANGLES = [-1.1, -0.55, 0, 0.55, 1.1] as const;

function CaterpillarStage({
  cuticleTex,
  geos,
}: {
  readonly cuticleTex: ReturnType<typeof useCuticleTextures>;
  readonly geos: ReturnType<typeof useStageGeometries>;
}) {
  return (
    <group position={[0, 0.06, 0]}>
      <mesh castShadow geometry={geos.larvaBody} receiveShadow>
        <meshPhysicalMaterial
          bumpMap={cuticleTex.bumpMap}
          bumpScale={0.014}
          clearcoat={0.36}
          clearcoatRoughness={0.34}
          map={cuticleTex.map}
          roughness={0.44}
        />
      </mesh>
      <mesh castShadow position={[0.245, 0.015, 0]} scale={[0.92, 1, 0.96]}>
        <sphereGeometry args={[0.054, 18, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.68}
          color={SPECIMEN_COLORS.caterpillarHead}
          roughness={0.28}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group key={`fil-${side}`}>
          <mesh
            castShadow
            geometry={geos.filament}
            position={[0.19, 0.055, side * 0.032]}
            scale={[1, 1, side]}
          >
            <meshStandardMaterial
              color={SPECIMEN_COLORS.caterpillarFilament}
              roughness={0.42}
            />
          </mesh>
          <mesh
            castShadow
            geometry={geos.filament}
            position={[-0.2, 0.038, side * 0.028]}
            rotation={[0, Math.PI, 0]}
            scale={[0.72, 0.72, -side * 0.72]}
          >
            <meshStandardMaterial
              color={SPECIMEN_COLORS.caterpillarFilament}
              roughness={0.42}
            />
          </mesh>
        </group>
      ))}
      {Arr.map(PROLEG_XS, (px) =>
        Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={`pl-${px}-${side}`}
            position={[px, -0.025, side * 0.042]}
          >
            <cylinderGeometry args={[0.014, 0.01, 0.036, 10]} />
            <meshStandardMaterial
              color={SPECIMEN_COLORS.caterpillarProleg}
              roughness={0.56}
            />
          </mesh>
        ))
      )}
      {Arr.map(SPIRACLE_XS, (sx) =>
        Arr.map([-1, 1] as const, (side) => (
          <mesh key={`sp-${sx}-${side}`} position={[sx, 0.032, side * 0.068]}>
            <sphereGeometry args={[0.007, 8, 6]} />
            <meshStandardMaterial
              color={SPECIMEN_COLORS.caterpillarSpiracle}
              roughness={0.5}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

function ChrysalisStage({
  geos,
}: {
  readonly geos: ReturnType<typeof useStageGeometries>;
}) {
  return (
    <group>
      <mesh castShadow geometry={geos.pupaTwig} receiveShadow>
        <SurfaceMaterial
          bump={0.9}
          color={SPECIMEN_COLORS.barkTwig}
          repeat={[3, 1]}
          roughness={0.9}
          surface="bark"
        />
      </mesh>
      <mesh position={[0.02, 0.505, 0.02]} scale={[1.4, 0.45, 1.4]}>
        <sphereGeometry args={[0.024, 14, 10]} />
        <meshStandardMaterial
          color={SPECIMEN_COLORS.chrysalisSilk}
          roughness={0.86}
        />
      </mesh>
      <mesh position={[0.02, 0.478, 0.02]}>
        <cylinderGeometry args={[0.008, 0.012, 0.042, 10]} />
        <meshStandardMaterial
          color={SPECIMEN_COLORS.chrysalisCremaster}
          roughness={0.42}
        />
      </mesh>
      <group position={[0.02, 0.135, 0.02]}>
        <mesh castShadow geometry={geos.chrysalis} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.78}
            clearcoatRoughness={0.16}
            color={SPECIMEN_COLORS.chrysalisJade}
            roughness={0.26}
          />
        </mesh>
        {Arr.map(GOLD_CROWN_ANGLES, (ang) => (
          <mesh
            key={`gc-${ang}`}
            position={[Math.sin(ang) * 0.098, 0.242, Math.cos(ang) * 0.098]}
          >
            <sphereGeometry args={[0.011, 10, 8]} />
            <meshStandardMaterial
              color={SPECIMEN_COLORS.chrysalisGold}
              metalness={0.88}
              roughness={0.18}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function GrasshopperStage({
  cuticleTex,
  geos,
  hasWings,
  isAdult,
}: {
  readonly cuticleTex: ReturnType<typeof useCuticleTextures>;
  readonly geos: ReturnType<typeof useStageGeometries>;
  readonly hasWings: boolean;
  readonly isAdult: boolean;
}) {
  return (
    <group position={[0, 0.085, 0]}>
      <mesh castShadow geometry={geos.larvaBody} receiveShadow>
        <meshPhysicalMaterial
          bumpMap={cuticleTex.bumpMap}
          bumpScale={0.012}
          clearcoat={0.38}
          map={cuticleTex.map}
          roughness={0.44}
        />
      </mesh>
      <mesh castShadow position={[0.14, 0.032, 0]} scale={[1.15, 1.02, 1.05]}>
        <cylinderGeometry args={[0.052, 0.058, 0.11, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.42}
          color={SPECIMEN_COLORS.ghPronotum}
          roughness={0.42}
        />
      </mesh>
      <group position={[0.24, 0.02, 0]}>
        <mesh castShadow scale={[0.92, 1.15, 0.9]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.46}
            color={SPECIMEN_COLORS.ghHead}
            roughness={0.42}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            key={`ghe-${side}`}
            position={[0.018, 0.016, side * 0.036]}
            scale={[0.85, 1.25, 0.7]}
          >
            <sphereGeometry args={[0.022, 14, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.85}
              color={SPECIMEN_COLORS.ghEye}
              roughness={0.18}
            />
          </mesh>
        ))}
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            geometry={geos.ghAntenna}
            key={`gha-${side}`}
            position={[0.034, 0.028, side * 0.016]}
            scale={[1, 1, side]}
          >
            <meshStandardMaterial
              color={SPECIMEN_COLORS.ghAntenna}
              roughness={0.48}
            />
          </mesh>
        ))}
      </group>
      {Arr.map([-1, 1] as const, (side) => (
        <group
          key={`hl-${side}`}
          position={[0.04, 0.01, side * 0.04]}
          scale={[1, 1, side]}
        >
          <mesh castShadow geometry={geos.hindFemur}>
            <meshPhysicalMaterial
              clearcoat={0.4}
              color={SPECIMEN_COLORS.ghFemur}
              roughness={0.42}
            />
          </mesh>
          <mesh castShadow geometry={geos.hindTibia}>
            <meshStandardMaterial
              color={SPECIMEN_COLORS.ghTibia}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}
      {hasWings
        ? Arr.map([-1, 1] as const, (side) => (
            <mesh
              castShadow
              geometry={geos.tegmina}
              key={`ghw-${side}`}
              position={[0.12, 0.056, side * 0.038]}
              rotation={[side * 0.36, Math.PI, -0.06]}
              scale={isAdult ? [1.05, 1, 1] : [0.42, 0.8, 0.65]}
            >
              <meshPhysicalMaterial
                clearcoat={0.34}
                color={SPECIMEN_COLORS.ghTegmina}
                opacity={0.88}
                roughness={0.44}
                side={DoubleSide}
                transparent
              />
            </mesh>
          ))
        : null}
    </group>
  );
}

/**
 * Renders each sculpted photorealistic metamorphosis stage:
 * ribbed pearlescent eggs, banded caterpillar or grasshopper nymph,
 * hanging jade chrysalis on woody twig, or winged adult insect.
 */
export function MetamorphosisOrganism({
  insect,
  instar,
  playing,
  stage,
}: {
  readonly insect: Insect;
  readonly instar: number;
  readonly playing: boolean;
  readonly stage: "adult" | "egg" | "larva" | "nymph" | "pupa";
}) {
  const cuticleTex = useCuticleTextures(insect);
  const geos = useStageGeometries();

  if (stage === "egg") {
    return (
      <group>
        {Arr.map(EGG_CLUTCH, (item) => (
          <mesh
            castShadow
            geometry={geos.egg}
            key={item.id}
            position={[item.pos[0], item.pos[1], item.pos[2]]}
            rotation={[item.rot[0], item.rot[1], item.rot[2]]}
          >
            <meshPhysicalMaterial
              clearcoat={0.78}
              clearcoatRoughness={0.18}
              color={SPECIMEN_COLORS.eggPearl}
              roughness={0.28}
            />
          </mesh>
        ))}
      </group>
    );
  }
  if (stage === "larva") {
    return <CaterpillarStage cuticleTex={cuticleTex} geos={geos} />;
  }
  if (stage === "pupa") {
    return <ChrysalisStage geos={geos} />;
  }
  if (stage === "adult" && insect === "butterfly") {
    return <MonarchButterfly playing={playing} />;
  }
  const isAdult = stage === "adult";
  return (
    <GrasshopperStage
      cuticleTex={cuticleTex}
      geos={geos}
      hasWings={isAdult || instar >= 3}
      isAdult={isAdult}
    />
  );
}
